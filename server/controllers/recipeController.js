/**
 * Recipe Controller - REFACTORED for Optimized API Usage
 *
 * Strategy:
 * 1. Initial seeding: Fetch 16 recipes from Spoonacular (one-time only)
 * 2. Browsing: Use MongoDB only (no API calls)
 * 3. Generation: API call on user click, max 5/day
 * 4. Caching: Cache generated recipes by preferences
 * 5. NO EDAMAM: All Edamam logic completely removed
 */

const mongoose = require("mongoose");
const SavedRecipe = require("../models/SavedRecipe");
const Recipe = require("../models/Recipe");
const optimizedRecipeService = require("../services/optimizedRecipeService");
const youtubeService = require("../services/youtubeService");

/**
 * @desc    Seed initial recipes (one-time only)
 * @route   POST /api/recipes/seed
 * @access  Public
 */
exports.seedRecipes = async (req, res) => {
  try {
    const result = await optimizedRecipeService.seedInitialRecipes();

    res.status(200).json(result);
  } catch (error) {
    console.error("Seed recipes error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error seeding recipes",
    });
  }
};

/**
 * @desc    Force reseed recipes (clears old data and refetches)
 * @route   POST /api/recipes/reseed
 * @access  Public (for testing)
 */
exports.reseedRecipes = async (req, res) => {
  try {
    const SeedingStatus = require("../models/SeedingStatus");

    // Clear the seeding status to force reseed
    await SeedingStatus.deleteMany({ name: "spoonacular" });
    console.log("[RESEED] Cleared seeding status");

    // Trigger new seed
    const result = await optimizedRecipeService.seedInitialRecipes();

    res.status(200).json({
      ...result,
      message: `Force reseeded: ${result.message}`,
    });
  } catch (error) {
    console.error("Reseed recipes error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error reseeding recipes",
    });
  }
};

/**
 * @desc    Browse recipes from database (NO API CALL)
 * @route   GET /api/recipes/healthy
 * @access  Public
 * Load from MongoDB cache, no Spoonacular API usage
 */
exports.getHealthyRecipes = async (req, res) => {
  try {
    const { condition, cuisine, diet } = req.query;

    const filters = {
      healthConditions: condition ? [condition] : [],
      diet: diet ? [diet] : [],
      cuisine: cuisine ? [cuisine] : [],
    };

    const result = await optimizedRecipeService.getRecipes(filters);

    res.status(200).json({
      success: result.success,
      data: result.data,
      source: result.source,
      cached: result.cached,
      message: "Recipes loaded from database (no API call)",
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
 * @desc    Generate personalized recipes (CONTROLLED API USAGE)
 * @route   POST /api/recipes/generate
 * @access  Private
 * Max 5 API calls per day. Falls back to DB if limit reached.
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
          "Daily generation limit reached (5 calls/day). Showing best available recipes.",
        limitReached: true,
      });
    }

    if (!result.success && result.fallbackToDatabase) {
      // API failed or no results - use DB fallback
      const fallbackRecipes =
        await optimizedRecipeService.getFallbackRecipes(preferences);

      return res.status(200).json({
        success: true,
        data: fallbackRecipes,
        source: "Database (fallback)",
        cached: true,
        message:
          "Generation service unavailable. Showing best available recipes.",
      });
    }

    res.status(200).json({
      success: result.success,
      data: result.data,
      source: result.source,
      cached: result.cached,
      callsRemaining: result.callsRemaining,
      message: result.message,
    });
  } catch (error) {
    console.error("Generate recipes error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error generating recipes",
    });
  }
};

/**
 * @desc    Search YouTube cooking videos
 * @route   POST /api/recipes/youtube-video
 * @access  Public
 * Called only when user clicks "Watch Tutorial"
 */
exports.searchYouTubeVideo = async (req, res) => {
  try {
    const { recipeName } = req.body;

    if (!recipeName) {
      return res.status(400).json({
        success: false,
        message: "Recipe name is required",
      });
    }

    const videoResult = await youtubeService.searchCookingVideos(recipeName, 1);

    res.status(200).json({
      success: videoResult.success,
      data: videoResult.data,
      cached: videoResult.cached,
      message: videoResult.message,
    });
  } catch (error) {
    console.error("YouTube video search error:", error);
    res.status(500).json({
      success: false,
      message: "Error searching for tutorial video",
    });
  }
};

/**
 * @desc    Get saved recipes for user
 * @route   GET /api/recipes/saved
 * @access  Private
 */
exports.getSavedRecipes = async (req, res) => {
  try {
    const userId = req.user.id;

    const savedRecipes = await SavedRecipe.find({ userId })
      .sort({ savedAt: -1 })
      .lean();

    const recipeObjectIds = savedRecipes
      .filter(
        (item) =>
          !Array.isArray(item.ingredients) ||
          item.ingredients.length === 0 ||
          !Array.isArray(item.instructions) ||
          item.instructions.length === 0,
      )
      .map((item) => item.recipeId)
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    let recipeMap = new Map();
    if (recipeObjectIds.length > 0) {
      const recipeDocs = await Recipe.find({ _id: { $in: recipeObjectIds } })
        .select(
          "_id description prepTime cookTime servings ingredients instructions nutrition tags title image",
        )
        .lean();

      recipeMap = new Map(recipeDocs.map((doc) => [String(doc._id), doc]));
    }

    const backfillOperations = [];

    const hydratedSavedRecipes = savedRecipes.map((saved) => {
      const canonicalRecipe = recipeMap.get(String(saved.recipeId));
      if (!canonicalRecipe) {
        return saved;
      }

      const hasIngredients =
        Array.isArray(saved.ingredients) && saved.ingredients.length > 0;
      const hasInstructions =
        Array.isArray(saved.instructions) && saved.instructions.length > 0;

      const hydrated = {
        ...saved,
        title: saved.title || canonicalRecipe.title || "",
        image: saved.image || canonicalRecipe.image || "",
        tags:
          Array.isArray(saved.tags) && saved.tags.length > 0
            ? saved.tags
            : canonicalRecipe.tags || [],
        description: saved.description || canonicalRecipe.description || "",
        prepTime: saved.prepTime || canonicalRecipe.prepTime || 0,
        cookTime: saved.cookTime || canonicalRecipe.cookTime || 0,
        servings: saved.servings || canonicalRecipe.servings || 0,
        ingredients: hasIngredients
          ? saved.ingredients
          : canonicalRecipe.ingredients || [],
        instructions: hasInstructions
          ? saved.instructions
          : canonicalRecipe.instructions || [],
        nutrition:
          saved.nutrition && Object.keys(saved.nutrition).length > 0
            ? saved.nutrition
            : canonicalRecipe.nutrition || {},
      };

      if (!hasIngredients || !hasInstructions) {
        backfillOperations.push({
          updateOne: {
            filter: { _id: saved._id },
            update: {
              $set: {
                description: hydrated.description,
                prepTime: hydrated.prepTime,
                cookTime: hydrated.cookTime,
                servings: hydrated.servings,
                ingredients: hydrated.ingredients,
                instructions: hydrated.instructions,
              },
            },
          },
        });
      }

      return hydrated;
    });

    if (backfillOperations.length > 0) {
      await SavedRecipe.bulkWrite(backfillOperations);
    }

    res.status(200).json({
      success: true,
      data: hydratedSavedRecipes,
      message: "Saved recipes retrieved successfully",
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
 * @desc    Save a recipe to favorites
 * @route   POST /api/recipes/save
 * @access  Private
 */
exports.saveRecipe = async (req, res) => {
  try {
    const {
      recipeId,
      title,
      image,
      tags,
      suitableFor,
      avoidFor,
      nutrition,
      description,
      prepTime,
      cookTime,
      servings,
      ingredients,
      instructions,
    } = req.body;
    const userId = req.user.id;

    // Check if already saved
    const existing = await SavedRecipe.findOne({ userId, recipeId });
    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Recipe already saved",
      });
    }

    // Save recipe
    await SavedRecipe.create({
      userId,
      recipeId,
      title,
      image,
      tags,
      description: description || "",
      prepTime: Number(prepTime) || 0,
      cookTime: Number(cookTime) || 0,
      servings: Number(servings) || 0,
      ingredients: Array.isArray(ingredients) ? ingredients : [],
      instructions: Array.isArray(instructions) ? instructions : [],
      healthBenefits: {
        suitableFor: Array.isArray(suitableFor) ? suitableFor : [],
        avoidFor: Array.isArray(avoidFor) ? avoidFor : [],
      },
      nutrition,
    });

    res.status(201).json({
      success: true,
      message: "Recipe saved successfully",
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
 * @desc    Remove a recipe from favorites
 * @route   DELETE /api/recipes/saved/:recipeId
 * @access  Private
 */
exports.removeRecipe = async (req, res) => {
  try {
    const { recipeId } = req.params;
    const userId = req.user.id;

    const result = await SavedRecipe.findOneAndDelete({ userId, recipeId });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Recipe not found in favorites",
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

/**
 * @desc    Get remaining generation calls for today
 * @route   GET /api/recipes/remaining-calls
 * @access  Public
 */
exports.getRemainingCalls = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const ApiRequestCounter = require("../models/ApiRequestCounter");
    let counter = await ApiRequestCounter.findOne({ date: today });

    if (!counter) {
      counter = await ApiRequestCounter.create({ date: today });
    }

    const remaining = Math.max(0, 5 - counter.generationCalls);

    res.status(200).json({
      success: true,
      callsUsed: counter.generationCalls,
      callsRemaining: remaining,
      callsLimit: 5,
      date: today,
    });
  } catch (error) {
    console.error("Remaining calls error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching remaining calls",
    });
  }
};

/**
 * @desc    Get quota status (for monitoring)
 * @route   GET /api/recipes/quota-status
 * @access  Public
 */
exports.getQuotaStatus = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const ApiRequestCounter = require("../models/ApiRequestCounter");
    let counter = await ApiRequestCounter.findOne({ date: today });

    if (!counter) {
      counter = await ApiRequestCounter.create({ date: today });
    }

    res.status(200).json({
      success: true,
      generationCallsUsed: counter.generationCalls,
      generationCallsLimit: 5,
      date: today,
      message: "Spoonacular quota for recipe generation (no Edamam)",
    });
  } catch (error) {
    console.error("Quota status error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching quota status",
    });
  }
};

/**
 * @desc    Get cache statistics (for debugging)
 * @route   GET /api/recipes/cache-stats
 * @access  Public
 */
exports.getCacheStats = async (req, res) => {
  try {
    const GeneratedRecipeCache = require("../models/GeneratedRecipeCache");
    const Recipe = require("../models/Recipe");

    const cachedGenerations = await GeneratedRecipeCache.countDocuments();
    const totalRecipes = await Recipe.countDocuments({ isSeeded: true });

    res.status(200).json({
      success: true,
      cachedGenerations,
      totalRecipesInDB: totalRecipes,
      message: "Cache statistics",
    });
  } catch (error) {
    console.error("Cache stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching cache stats",
    });
  }
};

/**
 * @desc    Clear cache (admin only)
 * @route   POST /api/recipes/cache-clear
 * @access  Private/Admin
 */
exports.clearCache = async (req, res) => {
  try {
    const GeneratedRecipeCache = require("../models/GeneratedRecipeCache");
    await GeneratedRecipeCache.deleteMany({});

    res.status(200).json({
      success: true,
      message: "Cache cleared successfully",
    });
  } catch (error) {
    console.error("Cache clear error:", error);
    res.status(500).json({
      success: false,
      message: "Error clearing cache",
    });
  }
};
