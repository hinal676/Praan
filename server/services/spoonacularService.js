/**
 * ⚠️ DEPRECATED - This file is no longer used
 *
 * The minimal API usage system now uses:
 * → optimizedRecipeService.js (Spoonacular only, max 5 calls/day)
 *
 * This legacy service included:
 * - Edamam API (removed)
 * - Complex quota tracking (deprecated)
 * - Comprehensive deduplication (replaced with preference-based caching)
 *
 * Keep this file for reference, but use optimizedRecipeService.js for all routes
 */

const axios = require("axios");
const cacheService = require("../utils/cacheService");
const quotaService = require("../utils/quotaService");

const SPOONACULAR_BASE_URL = "https://api.spoonacular.com/recipes";
const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY;

// Edamam API - DEPRECATED, no longer used in minimal API system
const EDAMAM_BASE_URL = "https://api.edamam.com/api/recipes/v2";
const EDAMAM_API_ID = process.env.EDAMAM_API_ID;
const EDAMAM_API_KEY = process.env.EDAMAM_API_KEY;

// In-flight requests tracking to prevent duplicate API calls
const inflightRequests = new Map();

class RecipeService {
  /**
   * Search recipes from Spoonacular with caching + deduplication
   * Fetches 10-15 recipes per request, cached for 30 minutes
   * Prevents duplicate calls for identical search parameters
   */
  async searchRecipes(preferences) {
    try {
      // Generate cache key
      const cacheKey = cacheService.generateKey(
        "spoonacular:search",
        preferences,
      );

      // Check cache first
      const cachedResult = cacheService.get(cacheKey);
      if (cachedResult) {
        console.log(`[Cache HIT] Spoonacular search: ${cacheKey}`);
        return { ...cachedResult, cached: true };
      }

      // Check for in-flight request to prevent duplicate API calls
      if (inflightRequests.has(cacheKey)) {
        console.log(
          `[Dedup] Returning in-flight Spoonacular request: ${cacheKey}`,
        );
        return await inflightRequests.get(cacheKey);
      }

      // Check quota availability
      const quotaStatus = await quotaService.checkQuotaAvailability(
        "SPOONACULAR",
        1,
      );
      if (!quotaStatus.available) {
        console.warn(
          `[Quota] Spoonacular quota exhausted. Daily limit: ${quotaStatus.dailyLimit}, Used: ${quotaStatus.used}`,
        );
        throw new Error(
          "Spoonacular daily quota exhausted. Please try again tomorrow.",
        );
      }

      const {
        dietaryPreferences = [],
        allergies = [],
        cuisinePreference = "",
        cookingTime = "",
        healthConditions = [],
      } = preferences;

      // Build query parameters
      let query = "";
      if (healthConditions.includes("diabetes")) {
        query += "diabetic ";
      }
      if (healthConditions.includes("cholesterol")) {
        query += "low-cholesterol ";
      }
      if (healthConditions.includes("pcos")) {
        query += "low-carb ";
      }

      if (dietaryPreferences.includes("vegan")) {
        query += "vegan ";
      } else if (dietaryPreferences.includes("veg")) {
        query += "vegetarian ";
      }

      const params = {
        apiKey: SPOONACULAR_API_KEY,
        number: 15, // Fetch 15 recipes per request
        addRecipeInformation: true,
        fillIngredients: true,
        type: this._mapDietType(dietaryPreferences),
        diet: this._mapDiet(dietaryPreferences),
        intolerances: allergies.join(","),
        cuisine: cuisinePreference,
        maxReadyTime: this._mapCookingTime(cookingTime),
        ranking: 2,
        query: query.trim(),
      };

      // Create in-flight promise
      const requestPromise = (async () => {
        try {
          const response = await axios.get(
            `${SPOONACULAR_BASE_URL}/complexSearch`,
            { params },
            { timeout: 10000 },
          );

          const result = {
            success: true,
            data: response.data.results,
            totalResults: response.data.totalResults,
            source: "Spoonacular",
            apiUsed: 1,
            timestamp: Date.now(),
          };

          // Cache for 30 minutes
          cacheService.set(cacheKey, result, "SPOONACULAR_RECIPES");

          // Track quota usage
          await quotaService.incrementUsage("SPOONACULAR", 1);

          console.log(
            `[API] Spoonacular search completed. Results: ${result.data.length}`,
          );
          return result;
        } catch (error) {
          inflightRequests.delete(cacheKey);
          throw error;
        }
      })();

      // Store in-flight request
      inflightRequests.set(cacheKey, requestPromise);

      const result = await requestPromise;
      inflightRequests.delete(cacheKey);

      return result;
    } catch (error) {
      console.error("Spoonacular search error:", error.message);
      throw new Error("Failed to search recipes from Spoonacular");
    }
  }

  /**
   * Generate personalized recipes using Edamam API
   * Called ONLY on "Generate Recipe" button click
   * Fetches max 1-2 recipes to reduce quota usage
   * With deduplication to prevent concurrent duplicate calls
   */
  async generatePersonalizedRecipes(preferences) {
    try {
      // Validate API credentials
      if (
        !EDAMAM_API_ID ||
        !EDAMAM_API_KEY ||
        EDAMAM_API_ID === "your_edamam_api_id"
      ) {
        console.warn(
          "Edamam API credentials not configured. Falling back to Spoonacular.",
        );
        return this.searchRecipes(preferences);
      }

      // Generate cache key including user preferences
      const cacheKey = cacheService.generateKey("edamam:generate", preferences);

      // Check cache first
      const cachedResult = cacheService.get(cacheKey);
      if (cachedResult) {
        console.log(`[Cache HIT] Edamam generation: ${cacheKey}`);
        return { ...cachedResult, cached: true };
      }

      // Check for in-flight request
      if (inflightRequests.has(cacheKey)) {
        console.log(`[Dedup] Returning in-flight Edamam request: ${cacheKey}`);
        return await inflightRequests.get(cacheKey);
      }

      // Check quota availability (Edamam quota)
      const quotaStatus = await quotaService.checkQuotaAvailability(
        "EDAMAM",
        1,
      );
      if (!quotaStatus.available) {
        console.warn(
          `[Quota] Edamam quota exhausted. Falling back to Spoonacular.`,
        );
        return this.searchRecipes(preferences);
      }

      const {
        dietaryPreferences = [],
        allergies = [],
        healthConditions = [],
      } = preferences;

      // Build health parameters for Edamam
      const healthParams = [];

      // Map health conditions to Edamam diet labels
      if (healthConditions.includes("diabetes")) {
        healthParams.push("vegan", "paleo");
      }
      if (healthConditions.includes("cholesterol")) {
        healthParams.push("low-fat");
      }
      if (healthConditions.includes("pcos")) {
        healthParams.push("low-carb", "high-protein");
      }

      // Map dietary preferences
      if (dietaryPreferences.includes("vegan")) {
        healthParams.push("vegan");
      } else if (dietaryPreferences.includes("veg")) {
        healthParams.push("vegetarian");
      }

      if (dietaryPreferences.includes("gluten-free")) {
        healthParams.push("gluten-free");
      }
      if (dietaryPreferences.includes("dairy-free")) {
        healthParams.push("dairy-free");
      }

      // Map intolerances
      const excludedParams = allergies.map((allergy) => `NOT ${allergy}`);

      const params = {
        type: "public",
        q: this._buildEdamamQuery(preferences),
        from: 0,
        to: 2, // Fetch max 2 recipes to save quota
        diet: healthParams.slice(0, 1),
        health: healthParams.slice(1),
        excluded: excludedParams,
      };

      const config = {
        headers: {},
        params: {
          ...params,
          app_id: EDAMAM_API_ID,
          app_key: EDAMAM_API_KEY,
        },
        timeout: 10000,
      };

      // Create in-flight promise
      const requestPromise = (async () => {
        try {
          const response = await axios.get(EDAMAM_BASE_URL, config);

          if (!response.data.hits || response.data.hits.length === 0) {
            console.log(
              "[Edamam] No recipes found, falling back to Spoonacular",
            );
            return this.searchRecipes(preferences);
          }

          const recipes = response.data.hits.map((hit) =>
            this._formatEdamamRecipe(hit.recipe),
          );

          const result = {
            success: true,
            data: recipes,
            source: "Edamam",
            totalResults: response.data.count,
            apiUsed: 1,
            timestamp: Date.now(),
          };

          // Cache for 1 hour
          cacheService.set(cacheKey, result, "EDAMAM_RECIPES");

          // Track quota usage
          await quotaService.incrementUsage("EDAMAM", 1);

          console.log(
            `[API] Edamam generation completed. Results: ${result.data.length}`,
          );
          return result;
        } catch (error) {
          inflightRequests.delete(cacheKey);
          throw error;
        }
      })();

      // Store in-flight request
      inflightRequests.set(cacheKey, requestPromise);

      const result = await requestPromise;
      inflightRequests.delete(cacheKey);

      return result;
    } catch (error) {
      console.error("Edamam API error:", error.message);
      // Gracefully fall back to Spoonacular
      console.log("Falling back to Spoonacular API...");
      return this.searchRecipes(preferences);
    }
  }

  /**
   * Get detailed recipe information with caching + quota tracking
   * Cached for 24 hours since recipe details rarely change
   */
  async getRecipeDetails(recipeId) {
    try {
      // Check cache first
      const cacheKey = `spoonacular:detail:${recipeId}`;
      const cachedResult = cacheService.get(cacheKey);

      if (cachedResult) {
        console.log(`[Cache HIT] Recipe details: ${recipeId}`);
        return { ...cachedResult, cached: true };
      }

      // Check quota
      const quotaStatus = await quotaService.checkQuotaAvailability(
        "SPOONACULAR",
        1,
      );
      if (!quotaStatus.available) {
        console.warn("[Quota] Spoonacular quota exhausted for recipe details");
        throw new Error("Spoonacular quota exhausted");
      }

      const params = {
        apiKey: SPOONACULAR_API_KEY,
        includeNutrition: true,
      };

      const response = await axios.get(
        `${SPOONACULAR_BASE_URL}/${recipeId}/information`,
        { params },
        { timeout: 10000 },
      );

      const result = {
        success: true,
        data: this._formatRecipeData(response.data),
        timestamp: Date.now(),
      };

      // Cache for 24 hours
      cacheService.set(cacheKey, result, "SPOONACULAR_DETAILS");

      // Track quota usage
      await quotaService.incrementUsage("SPOONACULAR", 1);

      return result;
    } catch (error) {
      console.error("Spoonacular detail error:", error.message);
      throw new Error("Failed to fetch recipe details");
    }
  }

  /**
   * Get nutritional information with quota tracking
   */
  async getNutritionInfo(recipeId) {
    try {
      const cacheKey = `spoonacular:nutrition:${recipeId}`;
      const cachedResult = cacheService.get(cacheKey);

      if (cachedResult) {
        console.log(`[Cache HIT] Nutrition info: ${recipeId}`);
        return { success: true, data: cachedResult, cached: true };
      }

      // Check quota
      const quotaStatus = await quotaService.checkQuotaAvailability(
        "SPOONACULAR",
        1,
      );
      if (!quotaStatus.available) {
        console.warn("[Quota] Spoonacular quota exhausted for nutrition");
        throw new Error("Spoonacular quota exhausted");
      }

      const params = {
        apiKey: SPOONACULAR_API_KEY,
      };

      const response = await axios.get(
        `${SPOONACULAR_BASE_URL}/${recipeId}/nutritionWidget.json`,
        { params },
        { timeout: 10000 },
      );

      // Cache for 24 hours
      cacheService.set(cacheKey, response.data, "SPOONACULAR_DETAILS");

      // Track quota usage
      await quotaService.incrementUsage("SPOONACULAR", 1);

      return {
        success: true,
        data: response.data,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("Nutrition info error:", error.message);
      throw new Error("Failed to fetch nutrition information");
    }
  }

  /**
   * Format Spoonacular recipe data
   */
  _formatRecipeData(data) {
    return {
      id: data.id,
      title: data.title,
      image: data.image,
      prepTime: data.readyInMinutes,
      cookTime: data.cookingMinutes || 0,
      servings: data.servings,
      ingredients: (data.extendedIngredients || []).map((ing) => ({
        name: ing.original,
        amount: ing.measures?.metric?.amount || ing.amount,
        unit: ing.measures?.metric?.unitShort || ing.unit,
      })),
      instructions: data.instructions || [],
      nutrition: data.nutrition?.nutrients || [],
      diets: data.diets || [],
      cuisines: data.cuisines || [],
      dishTypes: data.dishTypes || [],
      source: "Spoonacular",
    };
  }

  /**
   * Format Edamam recipe data
   */
  _formatEdamamRecipe(recipe) {
    const ingredients = recipe.ingredientLines || [];
    return {
      id: recipe.uri?.split("#")[1] || recipe.label,
      title: recipe.label,
      image: recipe.image,
      prepTime: 0, // Edamam doesn't provide prep time
      cookTime: 0,
      servings: recipe.yield || 4,
      ingredients: ingredients.map((ing, idx) => ({
        name: ing,
        amount: idx + 1,
        unit: "ingredient",
      })),
      instructions: [],
      nutrition: [
        {
          name: "Calories",
          amount: Math.round(recipe.calories),
          unit: "kcal",
        },
        {
          name: "Protein",
          amount: Math.round(recipe.totalNutrients.PROCNT?.quantity || 0),
          unit: "g",
        },
        {
          name: "Fat",
          amount: Math.round(recipe.totalNutrients.FAT?.quantity || 0),
          unit: "g",
        },
        {
          name: "Carbs",
          amount: Math.round(recipe.totalNutrients.CHOCDF?.quantity || 0),
          unit: "g",
        },
      ],
      diets: recipe.dietLabels || [],
      cuisines: ["International"],
      dishTypes: recipe.mealType || [],
      healthLabels: recipe.healthLabels || [],
      source: "Edamam",
      sourceUrl: recipe.url,
    };
  }

  /**
   * Build Edamam query from preferences
   */
  _buildEdamamQuery(preferences) {
    const { healthConditions = [], cuisinePreference = "" } = preferences;
    let query = [];

    if (healthConditions.includes("diabetes")) {
      query.push("low sugar");
    }
    if (healthConditions.includes("cholesterol")) {
      query.push("low fat");
    }
    if (cuisinePreference) {
      query.push(cuisinePreference);
    }

    return query.join(" ") || "healthy recipe";
  }

  _mapDiet(preferences) {
    const dietMap = {
      vegan: "vegan",
      "gluten-free": "gluten free",
      "dairy-free": "dairy free",
    };
    return preferences
      .filter((p) => dietMap[p])
      .map((p) => dietMap[p])
      .join(",");
  }

  _mapDietType(preferences) {
    if (preferences.includes("vegan")) return "vegan";
    if (preferences.includes("non-veg")) return "meat";
    return "all";
  }

  _mapCookingTime(cookingTime) {
    const timeMap = {
      "<15min": 15,
      "15-30min": 30,
      "30-45min": 45,
      ">45min": 300,
    };
    return timeMap[cookingTime] || 30;
  }
}

module.exports = new RecipeService();
