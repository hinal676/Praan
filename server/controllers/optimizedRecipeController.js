/**
 * OPTIMIZED Recipe Controller
 * Minimal API usage approach
 *
 * Endpoints:
 * - GET /api/recipes/browse - Load from DB only (no API)
 * - POST /api/recipes/generate - Generate on click, max 5/day
 * - GET /api/recipes/remaining-calls - Check daily limit
 * - POST /api/recipes/seed - Trigger initial seeding
 */

const SavedRecipe = require("../models/SavedRecipe");
const Recipe = require("../models/Recipe");
const optimizedRecipeService = require("../services/optimizedRecipeService");
const youtubeService = require("../services/youtubeService");

/**
 * @desc    Browse recipes from database (NO API CALL)
 * @route   GET /api/recipes/browse
 * @access  Public
 * Load from MongoDB cache, no Spoonacular API usage
 */
exports.browseRecipes = async (req, res) => {
  try {
    const { diet, cuisine, healthConditions } = req.query;

    const filters = {
      diet: diet ? [diet] : [],
      cuisine: cuisine ? [cuisine] : [],
      healthConditions: healthConditions ? [healthConditions] : [],
    };

    const result = await optimizedRecipeService.getRecipes(filters);

    res.status(200).json({
      success: result.success,
      data: result.data,
      source: result.source,
      cached: result.cached,
      message: "Recipes loaded from database",
    });
  } catch (error) {
    console.error("Browse recipes error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching recipes",
    });
  }
};

/**
 * @desc    Generate recipes on user click (CONTROLLED API USAGE)
 * @route   POST /api/recipes/generate
 * @access  Private
 * Max 5 API calls per day
 * Falls back to DB if limit reached
 */
exports.generateRecipes = async (req, res) => {
  try {
    const preferences = req.body;
    const userId = req.user?.id || null;

    console.log("[GENERATE] User request with preferences:", preferences);

    // Call the optimized service
    const result = await optimizedRecipeService.generateRecipes(
      preferences,
      userId,
    );

    if (!result.success && result.limitExceeded) {
      // Limit reached - use DB fallback
      console.log("[GENERATE] Limit exceeded, using DB fallback");

      const fallbackRecipes =
        await optimizedRecipeService.getFallbackRecipes(preferences);

      return res.status(200).json({
        success: true,
        data: fallbackRecipes,
        source: "Database (fallback)",
        cached: true,
        message:
          "Daily generation limit reached. Showing best available recipes.",
        limitReached: true,
      });
    }

    if (!result.success && result.fallbackToDatabase) {
      // API failed - use DB fallback
      const fallbackRecipes =
        await optimizedRecipeService.getFallbackRecipes(preferences);

      return res.status(200).json({
        success: true,
        data: fallbackRecipes,
        source: "Database (fallback)",
        cached: true,
        message:
          "Generation service unavailable. Showing best available recipes.",
        apiError: true,
      });
    }

    res.status(200).json({
      success: result.success,
      data: result.data,
      source: result.source,
      cached: result.cached,
      callsRemaining: result.callsRemaining,
      message: `Successfully generated recipes. Remaining calls today: ${result.callsRemaining}`,
    });
  } catch (error) {
    console.error("Generate recipes error:", error);

    // Last resort fallback
    const fallbackRecipes = await optimizedRecipeService.getFallbackRecipes(
      req.body,
    );

    res.status(200).json({
      success: true,
      data: fallbackRecipes,
      source: "Database (fallback)",
      cached: true,
      message: "Generation failed. Showing available recipes.",
    });
  }
};

/**
 * @desc    Check remaining API calls for today
 * @route   GET /api/recipes/remaining-calls
 * @access  Public
 */
exports.getRemainingCalls = async (req, res) => {
  try {
    const remaining = await optimizedRecipeService.getRemainingCalls();

    res.status(200).json({
      success: true,
      data: remaining,
      message: `${remaining.remaining} generation calls remaining today`,
    });
  } catch (error) {
    console.error("Error checking remaining calls:", error);
    res.status(500).json({
      success: false,
      message: "Error checking API limit",
    });
  }
};

/**
 * @desc    Seed initial recipes (ADMIN/ONE-TIME)
 * @route   POST /api/recipes/seed
 * @access  Private (admin)
 * Fetches 10 healthy recipes and stores in MongoDB
 */
exports.seedRecipes = async (req, res) => {
  try {
    console.log("[SEED] Seeding initiated");

    const result = await optimizedRecipeService.seedInitialRecipes();

    res.status(200).json({
      success: result.success,
      message: result.message,
      recipesCount: result.recipesCount,
    });
  } catch (error) {
    console.error("Seed recipes error:", error);
    res.status(500).json({
      success: false,
      message: "Error seeding recipes",
    });
  }
};

/**
 * @desc    Search YouTube tutorial for recipe
 * @route   POST /api/recipes/youtube
 * @access  Public
 * Called only on "Watch Tutorial" button click
 */
exports.searchYouTubeVideo = async (req, res) => {
  try {
    const { recipeName } = req.body;

    if (!recipeName) {
      return res.status(400).json({
        success: false,
        message: "Recipe name required",
      });
    }

    const videoResult = await youtubeService.searchCookingVideos(recipeName, 1);

    res.status(200).json({
      success: videoResult.success,
      data: videoResult.data,
      message: videoResult.message,
      cached: videoResult.cached,
    });
  } catch (error) {
    console.error("YouTube search error:", error);
    res.status(500).json({
      success: false,
      message: "Error searching for tutorial",
    });
  }
};

/**
 * @desc    Get user's saved recipes
 * @route   GET /api/recipes/saved
 * @access  Private
 */
exports.getSavedRecipes = async (req, res) => {
  try {
    const userId = req.user.id;

    const savedRecipes = await SavedRecipe.find({ userId }).sort({
      savedAt: -1,
    });

    res.status(200).json({
      success: true,
      data: savedRecipes,
    });
  } catch (error) {
    console.error("Get saved recipes error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching saved recipes",
    });
  }
};

/**
 * @desc    Save recipe to favorites
 * @route   POST /api/recipes/save
 * @access  Private
 */
exports.saveRecipe = async (req, res) => {
  try {
    const { recipeId, title, image, tags, nutrition } = req.body;
    const userId = req.user.id;

    // Check if already saved
    let savedRecipe = await SavedRecipe.findOne({ userId, recipeId });

    if (savedRecipe) {
      return res.status(400).json({
        success: false,
        message: "Recipe already saved",
      });
    }

    savedRecipe = await SavedRecipe.create({
      userId,
      recipeId,
      title,
      image,
      tags,
      nutrition,
    });

    res.status(201).json({
      success: true,
      data: savedRecipe,
    });
  } catch (error) {
    console.error("Save recipe error:", error);
    res.status(500).json({
      success: false,
      message: "Error saving recipe",
    });
  }
};

/**
 * @desc    Remove saved recipe
 * @route   DELETE /api/recipes/saved/:recipeId
 * @access  Private
 */
exports.removeRecipe = async (req, res) => {
  try {
    const userId = req.user.id;
    const { recipeId } = req.params;

    const result = await SavedRecipe.findOneAndDelete({ userId, recipeId });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Saved recipe not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Recipe removed from favorites",
    });
  } catch (error) {
    console.error("Remove recipe error:", error);
    res.status(500).json({
      success: false,
      message: "Error removing recipe",
    });
  }
};
