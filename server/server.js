const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const fs = require("fs");
// Load server/.env explicitly so env vars resolve correctly no matter which
// directory the process is started from (repo root `npm start` vs `cd server`).
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Import routes
const authRoutes = require("./routes/auth");
const recipeRoutes = require("./routes/recipes");
const userRoutes = require("./routes/users");
const { limiter } = require("./middlewares/rateLimit");

const app = express();
const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  // Trust the first proxy hop (e.g. Render/Railway/Nginx) so req.ip and
  // express-rate-limit see the real client IP instead of the proxy's.
  app.set("trust proxy", 1);
}

// FRONTEND_URL may hold a single origin or a comma-separated list (e.g. a
// production domain plus its www. alias).
const configuredOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set(
  isProduction
    ? configuredOrigins
    : [
        ...configuredOrigins,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://[::1]:3000",
      ],
);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (no Origin header) and configured origins.
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};

// Middleware
app.use(helmet()); // Security headers
app.use(cors(corsOptions));
app.use(limiter); // Rate limiting
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ limit: "10kb", extended: true }));

// Serve the built frontend in production, but only when it's actually
// present alongside this server (a combined single-process deploy). When
// the API is deployed on its own (e.g. behind a separately-hosted static
// frontend), client/dist won't exist here and this block is skipped so the
// SPA fallback below doesn't try to sendFile a missing index.html.
const clientDistPath = path.join(__dirname, "../client/dist");
const clientDistIndex = path.join(clientDistPath, "index.html");
const serveClientDist = isProduction && fs.existsSync(clientDistIndex);
if (serveClientDist) {
  app.use(express.static(clientDistPath));
}

// Import quota model for display
const ApiRequestCounter = require("./models/ApiRequestCounter");

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/praan", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ MongoDB connected");

    // Trigger one-time recipe seeding on startup
    const optimizedRecipeService = require("./services/optimizedRecipeService");
    optimizedRecipeService
      .seedInitialRecipes()
      .then((result) => {
        if (result.quotaLimited) {
          console.log(
            `[SEED] ⚠️  QUOTA LIMITED - ${result.recipesCount} demo recipes loaded`,
          );
          console.log(
            "[SEED] 💡 Tip: Upgrade your Spoonacular API plan or wait for daily quota reset",
          );
        } else if (result.success) {
          console.log(
            `[SEED] ✅ ${result.message} - ${result.recipesCount} recipes`,
          );
        } else {
          console.warn(`[SEED] ⚠️  ${result.message}`);
        }
      })
      .catch((err) => {
        console.error("[SEED] Error during startup seeding:", err.message);
      });

    // Display today's quota status (async, doesn't block server start)
    setTimeout(async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        let counter = await ApiRequestCounter.findOne({ date: today });

        if (!counter) {
          counter = await ApiRequestCounter.create({ date: today });
        }

        const remaining = Math.max(0, 5 - counter.generationCalls);
        console.log(`\n📊 QUOTA STATUS (${today})`);
        console.log(
          `   ├─ Generation Calls Used: ${counter.generationCalls}/5`,
        );
        console.log(`   ├─ Generation Calls Remaining: ${remaining}`);
        console.log(`   └─ Next Reset: Tomorrow 00:00 UTC\n`);
      } catch (err) {
        console.warn("⚠️  Could not fetch quota status:", err.message);
      }
    }, 1000);
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Health check route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date(),
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/users", userRoutes);
app.use("/api/user", userRoutes);

// Any /api/* route that didn't match above is a genuine 404, not SPA content.
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

if (serveClientDist) {
  // Let the React app handle client-side routing for every other GET route.
  app.get("*", (req, res) => {
    res.sendFile(clientDistIndex);
  });
}

// Fallback for anything else unmatched (non-GET routes, or any route at all
// in development, where the Vite dev server - not Express - serves the app).
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`${"=".repeat(50)}\n`);
});

module.exports = app;
