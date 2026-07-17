const express = require("express");
const {
  seedRecipes,
  reseedRecipes,
  generateRecipes,
  getHealthyRecipes,
  getSavedRecipes,
  saveRecipe,
  removeRecipe,
  searchYouTubeVideo,
  getQuotaStatus,
  getCacheStats,
  clearCache,
} = require("../controllers/recipeController");
const { protect, optionalAuth } = require("../middlewares/auth");
const { recipeLimiter } = require("../middlewares/rateLimit");
const {
  validateRecipeGeneration,
  validate,
} = require("../middlewares/validation");

const router = express.Router();

// Seeding routes (one-time initialization)
router.post("/seed", seedRecipes);
router.post("/reseed", reseedRecipes);

// Public routes
router.get("/healthy", optionalAuth, getHealthyRecipes);
router.post("/youtube-video", searchYouTubeVideo);

// Monitoring & Status routes (public)
router.get("/quota-status", getQuotaStatus);
router.get("/cache-stats", getCacheStats);

// Private routes
router.post(
  "/generate",
  protect,
  recipeLimiter,
  validateRecipeGeneration,
  validate,
  generateRecipes,
);
router.get("/saved", protect, getSavedRecipes);
router.post("/save", protect, saveRecipe);
router.delete("/saved/:recipeId", protect, removeRecipe);

// Admin routes
router.post("/cache-clear", protect, clearCache);

module.exports = router;
