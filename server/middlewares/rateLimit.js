const rateLimit = require("express-rate-limit");

// General rate limiter
exports.limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100, // 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for GET requests to recipes
    return req.method === "GET" && req.path.includes("/recipes");
  },
});

// Stricter limiter for auth routes
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Only 5 requests per 15 minutes
  message: "Too many login attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Recipe generation limiter
exports.recipeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 recipe generations per hour
  message: "Too many recipe generation requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
