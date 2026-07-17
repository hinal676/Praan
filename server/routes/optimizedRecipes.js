const express = require("express");
const {
  browseRecipes,
  generateRecipes,
  getRemainingCalls,
  seedRecipes,
  searchYouTubeVideo,
  getSavedRecipes,
  saveRecipe,
  removeRecipe,
} = require("../controllers/optimizedRecipeController");
const { protect, optionalAuth } = require("../middlewares/auth");

const router = express.Router();

/**
 * PUBLIC ENDPOINTS
 */

// Browse recipes from database (NO API CALL)
router.get("/browse", optionalAuth, browseRecipes);

// Check remaining API calls
router.get("/remaining-calls", getRemainingCalls);

// Search YouTube tutorial (on-demand)
router.post("/youtube", searchYouTubeVideo);

/**
 * PRIVATE ENDPOINTS
 */

// Generate recipes (max 5/day API calls)
router.post("/generate", protect, generateRecipes);

// Get user's saved recipes
router.get("/saved", protect, getSavedRecipes);

// Save recipe to favorites
router.post("/save", protect, saveRecipe);

// Remove saved recipe
router.delete("/saved/:recipeId", protect, removeRecipe);

/**
 * ADMIN ENDPOINTS
 */

// Seed initial recipes (one-time)
router.post("/seed", protect, seedRecipes);

module.exports = router;
