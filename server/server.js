const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
require("dotenv").config();

// Import routes
const authRoutes = require("./routes/auth");
const recipeRoutes = require("./routes/recipes");
const userRoutes = require("./routes/users");
const { limiter } = require("./middlewares/rateLimit");

const app = express();

const allowedOrigins = new Set([
  process.env.FRONTEND_URL || "http://localhost:3000",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://[::1]:3000",
]);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (no Origin header) and configured local origins.
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

// Serve static files from client directory
app.use(express.static(path.join(__dirname, "../client")));

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

// Fallback to serve index.html for SPA routing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

// Error handling for undefined routes
app.use("*", (req, res) => {
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
