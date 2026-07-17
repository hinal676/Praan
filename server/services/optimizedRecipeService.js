/**
 * OPTIMIZED Spoonacular Service
 * Minimal API usage - max 10 calls for seeding, max 5 for generation per day
 *
 * Strategy:
 * 1. ONE-TIME SEED: Fetch 10 healthy recipes on first run
 * 2. BROWSING: Always use DB (no API calls)
 * 3. GENERATION: API call only on user click, max 5/day
 * 4. CACHING: Cache generated recipes by preferences
 */

const axios = require("axios");
const Recipe = require("../models/Recipe");
const SeedingStatus = require("../models/SeedingStatus");
const ApiRequestCounter = require("../models/ApiRequestCounter");
const GeneratedRecipeCache = require("../models/GeneratedRecipeCache");
const crypto = require("crypto");

const SPOONACULAR_BASE_URL = "https://api.spoonacular.com/recipes";
const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY;

const MAX_GENERATION_CALLS_PER_DAY = 5;
const INITIAL_SEED_RECIPES = 16;
const GENERATION_CACHE_TTL_MS = 30 * 60 * 1000;

class OptimizedRecipeService {
  /**
   * SEED FUNCTION (ONE-TIME)
   * Fetch 16 healthy recipes and store in MongoDB
   * Called only once on app startup if not already seeded
   */
  async seedInitialRecipes() {
    try {
      // Check if already seeded with complete data
      let seedStatus = await SeedingStatus.findOne({ name: "spoonacular" });

      // Check if recipes already exist with complete instructions
      const existingRecipes = await Recipe.countDocuments({
        isSeeded: true,
        instructions: { $exists: true, $ne: [] },
      });

      if (seedStatus?.isSeeded && existingRecipes >= INITIAL_SEED_RECIPES) {
        console.log("[SEED] Already seeded with complete data. Skipping.");
        return {
          success: true,
          message: "Already seeded",
          recipesCount: existingRecipes,
        };
      }

      console.log("[SEED] Starting initial recipe fetch from Spoonacular...");

      const params = {
        apiKey: SPOONACULAR_API_KEY,
        number: INITIAL_SEED_RECIPES,
        addRecipeInformation: true,
        addInstructions: true,
        fillIngredients: true,
        type: "main course",
        ranking: 2,
        sort: "healthiness",
        minHealthScore: 0.5,
      };

      let response;
      try {
        response = await axios.get(`${SPOONACULAR_BASE_URL}/complexSearch`, {
          params,
          timeout: 15000,
        });
      } catch (apiError) {
        // Handle Spoonacular API errors
        const statusCode = apiError.response?.status;
        const errorMessage =
          apiError.response?.data?.message || apiError.message;

        if (statusCode === 402) {
          console.error("[SEED] ❌ API QUOTA EXCEEDED (402 Payment Required)");
          console.log(
            "[SEED] 💡 Solutions: 1) Upgrade Spoonacular API plan, 2) Wait for daily quota reset, 3) Using demo recipes instead",
          );
          // Fallback to demo/mock data
          console.log("[SEED] 📦 Loading demo recipes from mock data...");
          const demoRecipes = this._getMockRecipes();
          const recipesToSave = demoRecipes.map((recipe) =>
            this._formatRecipeData(recipe, true),
          );
          await Recipe.deleteMany({ isSeeded: true });
          await Recipe.insertMany(recipesToSave);

          seedStatus = await SeedingStatus.findOneAndUpdate(
            { name: "spoonacular" },
            {
              isSeeded: true,
              totalRecipes: recipesToSave.length,
              seededAt: new Date(),
            },
            { upsert: true, new: true },
          );

          console.log(
            `[SEED] ✅ Loaded ${recipesToSave.length} demo recipes (quota-limited mode)`,
          );
          return {
            success: true,
            message: `Loaded ${recipesToSave.length} demo recipes (API quota exceeded)`,
            recipesCount: recipesToSave.length,
            quotaLimited: true,
          };
        } else if (statusCode === 401) {
          throw new Error(
            `API Authentication failed (401): Check SPOONACULAR_API_KEY`,
          );
        } else if (statusCode) {
          throw new Error(
            `Spoonacular API error (${statusCode}): ${errorMessage}`,
          );
        }
        throw apiError;
      }

      if (!response.data.results || response.data.results.length === 0) {
        throw new Error("No recipes received from Spoonacular");
      }

      // Fetch detailed information for each recipe to ensure instructions are complete
      const detailedRecipes = await Promise.all(
        response.data.results.slice(0, INITIAL_SEED_RECIPES).map((recipe) =>
          axios
            .get(`${SPOONACULAR_BASE_URL}/${recipe.id}/information`, {
              params: {
                apiKey: SPOONACULAR_API_KEY,
                includeNutrition: true,
              },
              timeout: 10000,
            })
            .then((res) => {
              console.log(
                `[SEED] Fetched details for recipe ${res.data.title} - analyzedInstructions: ${res.data.analyzedInstructions ? res.data.analyzedInstructions.length : 0} steps`,
              );
              return res.data;
            })
            .catch((err) => {
              console.warn(
                `[SEED] Could not fetch details for recipe ${recipe.id}:`,
                err.message,
              );
              return recipe; // Fallback to basic recipe
            }),
        ),
      );

      // Save recipes to MongoDB (delete old ones first to ensure fresh data)
      await Recipe.deleteMany({ isSeeded: true });

      const recipesToSave = detailedRecipes.map((recipe) =>
        this._formatRecipeData(recipe, true),
      );

      await Recipe.insertMany(recipesToSave);

      // Mark as seeded
      seedStatus = await SeedingStatus.findOneAndUpdate(
        { name: "spoonacular" },
        {
          isSeeded: true,
          totalRecipes: recipesToSave.length,
          seededAt: new Date(),
        },
        { upsert: true, new: true },
      );

      console.log(
        `[SEED] ✅ Successfully seeded ${recipesToSave.length} recipes`,
      );

      return {
        success: true,
        message: `Seeded ${recipesToSave.length} recipes`,
        recipesCount: recipesToSave.length,
      };
    } catch (error) {
      const statusCode = error.response?.status;
      const errorMessage = error.message;

      if (statusCode === 402) {
        console.error(
          "[SEED] ❌ API QUOTA EXCEEDED - Using mock recipes as fallback",
        );
      } else {
        console.error("[SEED] Error during seeding:", errorMessage);
      }

      return {
        success: false,
        message: errorMessage,
        statusCode,
        recipesCount: 0,
      };
    }
  }

  /**
   * GET BROWSABLE RECIPES (NO API CALL)
   * Load recipes from MongoDB only
   * Used for recipe discovery/browsing
   */
  async getRecipes(filters = {}) {
    try {
      // Build query
      const query = { isSeeded: true };

      if (filters.diet && filters.diet.length > 0) {
        query.diets = { $in: filters.diet };
      }

      if (filters.cuisine && filters.cuisine.length > 0) {
        query.cuisines = { $in: filters.cuisine };
      }

      if (filters.healthConditions && filters.healthConditions.length > 0) {
        query.healthLabels = { $in: filters.healthConditions };
      }

      const recipes = await Recipe.find(query)
        .limit(15)
        .sort({ createdAt: -1 });

      console.log(`[DB] Retrieved ${recipes.length} recipes from database`);

      return {
        success: true,
        data: recipes,
        source: "Database (cached)",
        cached: true,
      };
    } catch (error) {
      console.error("[DB] Error fetching recipes:", error.message);
      return {
        success: false,
        data: [],
        message: error.message,
      };
    }
  }

  /**
   * GENERATE RECIPES (CONTROLLED API USAGE)
   * Called only when user clicks "Generate Recipe" button
   * Strict limit: max 5 calls per day
   */
  async generateRecipes(preferences, userId = null) {
    try {
      const normalizedPreferences = this._normalizePreferences(preferences);

      // ========== STEP 1: Check daily limit ==========
      const today = new Date().toISOString().split("T")[0];
      let counter = await ApiRequestCounter.findOne({ date: today });

      if (!counter) {
        counter = new ApiRequestCounter({ date: today });
      }

      if (counter.generationCalls >= MAX_GENERATION_CALLS_PER_DAY) {
        console.log(
          `[LIMIT] Daily generation limit reached (${MAX_GENERATION_CALLS_PER_DAY})`,
        );
        return {
          success: false,
          message: `Daily limit reached (${MAX_GENERATION_CALLS_PER_DAY} calls). Try again tomorrow.`,
          limitExceeded: true,
          fallbackToDatabase: true,
        };
      }

      // ========== STEP 2: Check cache by preferences ==========
      const preferencesHash = this._hashPreferences(normalizedPreferences);
      const cached = await GeneratedRecipeCache.findOne({
        preferencesHash,
      });

      if (cached) {
        const isExpired =
          !cached.expiresAt || cached.expiresAt.getTime() <= Date.now();
        const cacheMatchesPreferences =
          this._stringifyPreferencesForKey(cached.preferences || {}) ===
          this._stringifyPreferencesForKey(normalizedPreferences);

        if (isExpired || !cacheMatchesPreferences) {
          await GeneratedRecipeCache.deleteOne({ _id: cached._id });
        }

        // Verify cached recipes have ingredients and instructions
        const hasCompleteData =
          !isExpired &&
          cacheMatchesPreferences &&
          cached.recipes.every(
            (r) =>
              r.ingredients &&
              Array.isArray(r.ingredients) &&
              r.ingredients.length > 0 &&
              r.instructions &&
              Array.isArray(r.instructions) &&
              r.instructions.length > 0,
          );

        if (hasCompleteData) {
          console.log(
            `[CACHE] Generated recipes found for these preferences (cached)`,
          );
          return {
            success: true,
            data: cached.recipes,
            source: "Cached generation",
            cached: true,
          };
        } else {
          // Old cache format without ingredients/instructions - delete and regenerate
          console.log(
            `[CACHE] Old cache format detected - deleting and regenerating with full data`,
          );
          await GeneratedRecipeCache.deleteOne({ _id: cached._id });
        }
      }

      // ========== STEP 3: API CALL (with all checks passed) ==========
      console.log(
        `[API] Calling Spoonacular (generation ${counter.generationCalls + 1}/${MAX_GENERATION_CALLS_PER_DAY})`,
      );

      const params = {
        apiKey: SPOONACULAR_API_KEY,
        number: 2,
        addRecipeInformation: true,
        addInstructions: true,
        fillIngredients: true,
        type: "main course",
      };

      // Add diet filter
      if (normalizedPreferences.diet && normalizedPreferences.diet.length > 0) {
        params.diet = normalizedPreferences.diet[0];
      }

      // Add intolerances
      if (
        normalizedPreferences.intolerances &&
        normalizedPreferences.intolerances.length > 0
      ) {
        params.intolerances = normalizedPreferences.intolerances.join(",");
      }

      if (normalizedPreferences.cuisine) {
        params.cuisine = normalizedPreferences.cuisine;
      }

      if (normalizedPreferences.maxReadyTime) {
        params.maxReadyTime = normalizedPreferences.maxReadyTime;
      }

      let response;
      try {
        response = await axios.get(`${SPOONACULAR_BASE_URL}/complexSearch`, {
          params,
          timeout: 15000,
        });
      } catch (apiError) {
        const statusCode = apiError.response?.status;
        const errorMessage =
          apiError.response?.data?.message || apiError.message;

        if (statusCode === 402) {
          console.warn(
            "[API] ⚠️  API Quota exceeded (402). Falling back to database recipes.",
          );
          return {
            success: false,
            message: "API quota exceeded. Using database recipes instead.",
            quotaExceeded: true,
            fallbackToDatabase: true,
          };
        } else if (statusCode === 401) {
          console.error("[API] ❌ API Key invalid (401)");
          return {
            success: false,
            message: "API authentication failed. Check your API key.",
            fallbackToDatabase: true,
          };
        }

        console.error(
          `[API] Error calling Spoonacular (${statusCode}): ${errorMessage}`,
        );
        return {
          success: false,
          message: `API error: ${errorMessage}`,
          fallbackToDatabase: true,
        };
      }

      if (!response.data.results || response.data.results.length === 0) {
        console.log("[API] No recipes found, returning DB fallback");
        return {
          success: false,
          message: "No recipes found for your preferences",
          fallbackToDatabase: true,
        };
      }

      const recentRecipeIds = await this._getRecentlyServedRecipeIds(userId);

      const validApiRecipes = this._filterRecipesByDiet(
        response.data.results,
        normalizedPreferences,
      );

      const nonRepeatedRecipes = validApiRecipes.filter(
        (r) => !recentRecipeIds.has(r.id),
      );

      const selectedApiRecipes = this._shuffleRecipes(
        nonRepeatedRecipes.length > 0 ? nonRepeatedRecipes : validApiRecipes,
      ).slice(0, 2);

      if (selectedApiRecipes.length === 0) {
        console.log("[API] No recipes found, returning DB fallback");
        return {
          success: false,
          message: "No recipes found for your preferences",
          fallbackToDatabase: true,
        };
      }

      // Fetch detailed information for each recipe to ensure complete instructions
      const detailedRecipes = await Promise.all(
        selectedApiRecipes.map((recipe) =>
          axios
            .get(`${SPOONACULAR_BASE_URL}/${recipe.id}/information`, {
              params: {
                apiKey: SPOONACULAR_API_KEY,
                includeNutrition: true,
              },
              timeout: 10000,
            })
            .then((res) => {
              console.log(
                `[GENERATE] Fetched details for recipe ${res.data.title} - analyzedInstructions: ${res.data.analyzedInstructions ? res.data.analyzedInstructions.length : 0} steps`,
              );
              return res.data;
            })
            .catch((err) => {
              console.warn(
                `[API] Could not fetch details for recipe ${recipe.id}:`,
                err.message,
              );
              return recipe; // Fallback to basic recipe
            }),
        ),
      );

      // ========== STEP 4: Save to cache ==========
      const recipesToCache = detailedRecipes.map((r) => ({
        spoonacularId: r.id,
        title: r.title,
        image: r.image,
        prepTime: 0,
        cookTime: r.readyInMinutes || 30,
        servings: r.servings || 4,
        ingredients: (r.extendedIngredients || []).map((ing) => ({
          name: ing.original,
          amount: ing.measures?.metric?.amount || ing.amount,
          unit: ing.measures?.metric?.unitShort || ing.unit,
        })),
        instructions: this._extractInstructions(r),
        nutrition: {
          calories:
            r.nutrition?.nutrients?.find((n) => n.name === "Calories")
              ?.amount || 0,
          carbs:
            r.nutrition?.nutrients?.find((n) => n.name === "Carbohydrates")
              ?.amount || 0,
          protein:
            r.nutrition?.nutrients?.find((n) => n.name === "Protein")?.amount ||
            0,
          fat:
            r.nutrition?.nutrients?.find((n) => n.name === "Fat")?.amount || 0,
        },
        diets: r.diets || [],
        vegan: Boolean(r.vegan),
        vegetarian: Boolean(r.vegetarian),
        cuisines: r.cuisines || [],
        dishTypes: r.dishTypes || [],
        healthLabels: r.healthLabels || [],
      }));

      if (recipesToCache.length === 0) {
        console.log("[API] No recipes found, returning DB fallback");
        return {
          success: false,
          message: "No recipes found for your preferences",
          fallbackToDatabase: true,
        };
      }

      await GeneratedRecipeCache.findOneAndUpdate(
        { preferencesHash },
        {
          preferencesHash,
          userId,
          preferences: normalizedPreferences,
          recipes: recipesToCache,
          apiCallsUsed: 1,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + GENERATION_CACHE_TTL_MS),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      // ========== STEP 5: Increment counter ==========
      counter.generationCalls += 1;
      await counter.save();

      console.log(
        `[API] ✅ Generated ${recipesToCache.length} recipes. Calls today: ${counter.generationCalls}/${MAX_GENERATION_CALLS_PER_DAY}`,
      );

      return {
        success: true,
        data: recipesToCache,
        source: "Spoonacular",
        cached: false,
        callsRemaining: MAX_GENERATION_CALLS_PER_DAY - counter.generationCalls,
      };
    } catch (error) {
      const statusCode = error.response?.status;

      if (statusCode === 402) {
        console.error(
          "[API] ❌ Generation failed: API quota exceeded (402). Fallback to database.",
        );
        return {
          success: false,
          message:
            "API quota exceeded. Showing recipes from our database instead.",
          quotaExceeded: true,
          fallbackToDatabase: true,
        };
      }

      console.error("[API] Generation error:", error.message);
      return {
        success: false,
        message: error.message,
        fallbackToDatabase: true,
      };
    }
  }

  /**
   * GET FALLBACK RECIPES (NO API)
   * When generation limit reached or API fails
   * Get recipes from DB filtered by preferences
   */
  async getFallbackRecipes(preferences = {}) {
    try {
      const normalizedPreferences = this._normalizePreferences(preferences);
      const query = {};

      if (normalizedPreferences.diet && normalizedPreferences.diet.length > 0) {
        query.diets = { $in: normalizedPreferences.diet };
      }

      if (normalizedPreferences.cuisine) {
        query.cuisines = { $in: [normalizedPreferences.cuisine] };
      }

      const healthPreferenceTags = [
        ...(normalizedPreferences.healthConditions || []),
        ...(normalizedPreferences.deficiencies || []),
      ];
      if (healthPreferenceTags.length > 0) {
        query.healthLabels = { $in: healthPreferenceTags };
      }

      if (normalizedPreferences.maxReadyTime) {
        query.cookTime = { $lte: normalizedPreferences.maxReadyTime };
      }

      if (
        normalizedPreferences.intolerances &&
        normalizedPreferences.intolerances.length > 0
      ) {
        // Filter out recipes with intolerances
        const recipes = await Recipe.find(query).limit(5);
        const safeRecipes = recipes.filter(
          (r) =>
            !normalizedPreferences.intolerances.some((allergen) =>
              r.ingredients?.some((ing) =>
                ing.name.toLowerCase().includes(allergen.toLowerCase()),
              ),
            ),
        );
        return this._filterRecipesByDiet(safeRecipes, normalizedPreferences);
      }

      const recipes = await Recipe.find(query).limit(5);
      return this._filterRecipesByDiet(recipes, normalizedPreferences);
    } catch (error) {
      console.error("[FALLBACK] Error:", error.message);
      return [];
    }
  }

  /**
   * Helper: Extract instructions from Spoonacular recipe
   */
  _extractInstructions(recipe) {
    // Spoonacular returns instructions in analyzedInstructions array
    if (
      recipe.analyzedInstructions &&
      Array.isArray(recipe.analyzedInstructions) &&
      recipe.analyzedInstructions.length > 0
    ) {
      const steps = recipe.analyzedInstructions
        .flatMap((instruction) => instruction.steps || [])
        .map((step) => (typeof step === "string" ? step : step?.step || ""))
        .filter(Boolean);

      if (steps.length > 0) {
        console.log(
          `[INSTRUCTIONS] Extracted ${steps.length} steps from analyzedInstructions`,
        );
        return steps;
      }
    }

    // Fallback to plain instructions field if available
    if (recipe.instructions && typeof recipe.instructions === "string") {
      // If it's HTML, extract text
      if (recipe.instructions.includes("<")) {
        const temp = recipe.instructions
          .replace(/<[^>]+>/g, " ")
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter((s) => s.length > 5); // More lenient filter
        if (temp.length > 0) {
          console.log(
            `[INSTRUCTIONS] Extracted ${temp.length} steps from HTML instructions field`,
          );
          return temp;
        }
      }
      // Otherwise split by newlines or periods
      const steps = recipe.instructions
        .split(/\r?\n|\.(?=\s)/)
        .map((s) => s.trim())
        .filter((s) => s.length > 5); // More lenient filter
      if (steps.length > 0) {
        console.log(
          `[INSTRUCTIONS] Extracted ${steps.length} steps from plain instructions field`,
        );
        return steps;
      }
    }

    // Try extractedText field (some Spoonacular recipes have this)
    if (recipe.extractedText && typeof recipe.extractedText === "string") {
      const steps = recipe.extractedText
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 5);
      if (steps.length > 0) {
        console.log(
          `[INSTRUCTIONS] Extracted ${steps.length} steps from extractedText field`,
        );
        return steps;
      }
    }

    console.warn(
      `[INSTRUCTIONS] No instructions found for recipe ${recipe.title || recipe.id}`,
    );
    // Last resort: return empty array
    return [];
  }

  /**
   * Helper: Format recipe data from Spoonacular
   */
  _formatRecipeData(recipe, isSeeded = false) {
    // Generate tags from health labels and diet info
    const tags = [
      ...(recipe.healthLabels || []).slice(0, 3),
      ...(recipe.diets || [])
        .map((d) => {
          if (d === "gluten free") return "Gluten-Free";
          if (d === "dairy free") return "Dairy-Free";
          if (d === "vegan") return "Vegan";
          if (d === "vegetarian") return "Vegetarian";
          if (d === "paleo") return "Paleo";
          if (d === "keto") return "Keto";
          return d
            .split(" ")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
        })
        .slice(0, 2),
    ].slice(0, 3);

    const instructions = this._extractInstructions(recipe);
    console.log(
      `[FORMAT] Recipe "${recipe.title}": ${instructions.length} instructions extracted`,
    );

    return {
      spoonacularId: recipe.id,
      title: recipe.title,
      image: recipe.image,
      description: recipe.summary || "",
      prepTime: 0,
      cookTime: recipe.readyInMinutes || 30,
      servings: recipe.servings || 4,
      tags: tags.length > 0 ? tags : ["Healthy"],
      ingredients: (recipe.extendedIngredients || []).map((ing) => ({
        name: ing.original,
        amount: ing.measures?.metric?.amount || ing.amount,
        unit: ing.measures?.metric?.unitShort || ing.unit,
      })),
      instructions,
      nutrition: {
        calories:
          recipe.nutrition?.nutrients?.find((n) => n.name === "Calories")
            ?.amount || 0,
        carbs:
          recipe.nutrition?.nutrients?.find((n) => n.name === "Carbohydrates")
            ?.amount || 0,
        protein:
          recipe.nutrition?.nutrients?.find((n) => n.name === "Protein")
            ?.amount || 0,
        fat:
          recipe.nutrition?.nutrients?.find((n) => n.name === "Fat")?.amount ||
          0,
      },
      diets: recipe.diets || [],
      vegan: Boolean(recipe.vegan),
      vegetarian: Boolean(recipe.vegetarian),
      cuisines: recipe.cuisines || [],
      dishTypes: recipe.dishTypes || [],
      healthLabels: recipe.healthLabels || [],
      source: "Spoonacular",
      isSeeded,
    };
  }

  /**
   * Helper: Create hash of preferences for caching
   */
  _hashPreferences(preferences) {
    const key = this._stringifyPreferencesForKey(preferences);
    return crypto.createHash("md5").update(key).digest("hex");
  }

  _stringifyPreferencesForKey(preferences) {
    return JSON.stringify({
      dietaryPreferences: [...(preferences.dietaryPreferences || [])].sort(),
      allergies: [...(preferences.allergies || [])].sort(),
      healthConditions: [...(preferences.healthConditions || [])].sort(),
      deficiencies: [...(preferences.deficiencies || [])].sort(),
      cuisinePreference: preferences.cuisinePreference || "",
      cookingTime: preferences.cookingTime || "",
      diet: [...(preferences.diet || [])].sort(),
      intolerances: [...(preferences.intolerances || [])].sort(),
      cuisine: preferences.cuisine || "",
      maxReadyTime: preferences.maxReadyTime || null,
    });
  }

  _normalizePreferences(preferences = {}) {
    const dietaryPreferences = Array.isArray(preferences.dietaryPreferences)
      ? preferences.dietaryPreferences
      : Array.isArray(preferences.diet)
        ? preferences.diet
        : [];
    const allergies = Array.isArray(preferences.allergies)
      ? preferences.allergies
      : Array.isArray(preferences.intolerances)
        ? preferences.intolerances
        : [];
    const healthConditions = Array.isArray(preferences.healthConditions)
      ? preferences.healthConditions
      : [];
    const deficiencies = Array.isArray(preferences.deficiencies)
      ? preferences.deficiencies
      : [];

    const normalizedDietaryPreferences = [
      ...new Set(dietaryPreferences.map((d) => `${d}`.trim().toLowerCase())),
    ].filter((value) => value && value !== "none" && value !== "any");
    const normalizedAllergies = [
      ...new Set(allergies.map((a) => `${a}`.trim().toLowerCase())),
    ].filter((value) => value && value !== "none" && value !== "any");
    const normalizedHealthConditions = [
      ...new Set(healthConditions.map((h) => `${h}`.trim().toLowerCase())),
    ].filter((value) => value && value !== "none" && value !== "any");
    const normalizedDeficiencies = [
      ...new Set(deficiencies.map((d) => `${d}`.trim().toLowerCase())),
    ].filter((value) => value && value !== "none" && value !== "any");

    let mappedDiet = [];
    if (normalizedDietaryPreferences.includes("vegan")) {
      mappedDiet = ["vegan"];
    } else if (normalizedDietaryPreferences.includes("veg")) {
      mappedDiet = ["vegetarian"];
    }

    const rawCuisinePreference = (
      preferences.cuisinePreference ||
      preferences.cuisine ||
      ""
    )
      .trim()
      .toLowerCase();
    // UI currently labels "thai" as "Any Cuisine"; avoid over-filtering in that state.
    const cuisinePreference =
      rawCuisinePreference === "any" ||
      rawCuisinePreference === "none" ||
      rawCuisinePreference === "thai"
        ? ""
        : rawCuisinePreference;
    const cookingTime = `${
      preferences.cookingTime || preferences.maxReadyTime || ""
    }`.trim();
    const parsedCookingTime = this._parseCookingTimeToMaxReadyTime(cookingTime);

    return {
      dietaryPreferences: normalizedDietaryPreferences,
      allergies: normalizedAllergies,
      healthConditions: normalizedHealthConditions,
      deficiencies: normalizedDeficiencies,
      cuisinePreference,
      cookingTime,
      diet: mappedDiet,
      intolerances: normalizedAllergies,
      cuisine: cuisinePreference || "",
      maxReadyTime:
        Number.isFinite(parsedCookingTime) && parsedCookingTime > 0
          ? parsedCookingTime
          : null,
    };
  }

  _parseCookingTimeToMaxReadyTime(cookingTimeValue = "") {
    const value = `${cookingTimeValue}`.trim().toLowerCase();
    if (!value) {
      return null;
    }

    if (value === "<15min") {
      return 15;
    }
    if (value === "15-30min") {
      return 30;
    }
    if (value === "30-45min") {
      return 45;
    }
    if (value === ">45min") {
      return null;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  _filterRecipesByDiet(recipes = [], normalizedPreferences = {}) {
    const requiresVegan = (normalizedPreferences.diet || []).includes("vegan");
    const requiresVegetarian = (normalizedPreferences.diet || []).includes(
      "vegetarian",
    );

    return (recipes || []).filter((recipe) => {
      if (requiresVegan && recipe.vegan !== true) {
        return false;
      }
      if (requiresVegetarian && recipe.vegetarian !== true) {
        return false;
      }
      return true;
    });
  }

  async _getRecentlyServedRecipeIds(userId) {
    if (!userId) {
      return new Set();
    }

    const recentCaches = await GeneratedRecipeCache.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("recipes.spoonacularId createdAt expiresAt");

    const now = Date.now();
    const ids = new Set();
    recentCaches.forEach((cacheEntry) => {
      const isExpired =
        cacheEntry.expiresAt && cacheEntry.expiresAt.getTime() <= now;
      if (!isExpired) {
        (cacheEntry.recipes || []).forEach((recipe) => {
          if (recipe.spoonacularId) {
            ids.add(recipe.spoonacularId);
          }
        });
      }
    });

    return ids;
  }

  _shuffleRecipes(recipes = []) {
    const items = [...recipes];
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  /**
   * Get mock recipes for when API quota is exceeded
   * Demo data with complete instructions to keep app functional
   */
  _getMockRecipes() {
    return [
      {
        id: 1000001,
        title: "Grilled Salmon with Asparagus",
        image: "https://spoonacular.com/recipeImages/1000001-312x231.jpg",
        summary:
          "A delicious grilled salmon fillet served with fresh asparagus and lemon butter.",
        readyInMinutes: 25,
        servings: 2,
        vegan: false,
        vegetarian: false,
        diets: ["gluten free", "dairy free"],
        cuisines: ["French", "Mediterranean"],
        dishTypes: ["main course", "lunch"],
        healthLabels: ["High-Protein", "Omega-3 Rich"],
        extendedIngredients: [
          {
            original: "2 salmon fillets (6 oz each)",
            measures: { metric: { amount: 170, unitShort: "g" } },
          },
          {
            original: "1 bunch fresh asparagus",
            measures: { metric: { amount: 300, unitShort: "g" } },
          },
          {
            original: "2 tbsp olive oil",
            measures: { metric: { amount: 30, unitShort: "ml" } },
          },
          {
            original: "1 lemon",
            measures: { metric: { amount: 1, unitShort: "" } },
          },
          {
            original: "Sea salt and pepper to taste",
            measures: { metric: { amount: 1, unitShort: "tsp" } },
          },
        ],
        analyzedInstructions: [
          {
            steps: [
              {
                step: "Preheat grill to medium-high heat (about 400°F). Pat salmon dry with paper towels.",
              },
              {
                step: "Toss asparagus with olive oil, salt, and pepper in a bowl.",
              },
              { step: "Place salmon skin-side up on grill for 5-6 minutes." },
              {
                step: "Flip salmon and grill for another 4-5 minutes until cooked through.",
              },
              {
                step: "Grill asparagus alongside salmon for 4-5 minutes until tender.",
              },
              {
                step: "Squeeze fresh lemon juice over salmon and asparagus. Serve immediately.",
              },
            ],
          },
        ],
        nutrition: {
          nutrients: [
            { name: "Calories", amount: 320 },
            { name: "Carbohydrates", amount: 8 },
            { name: "Protein", amount: 35 },
            { name: "Fat", amount: 16 },
          ],
        },
      },
      {
        id: 1000002,
        title: "Quinoa Buddha Bowl",
        image: "https://spoonacular.com/recipeImages/1000002-312x231.jpg",
        summary:
          "A colorful plant-based bowl packed with quinoa, roasted vegetables, and tahini dressing.",
        readyInMinutes: 30,
        servings: 1,
        vegan: true,
        vegetarian: true,
        diets: ["vegan", "gluten free"],
        cuisines: ["Mediterranean", "Indian"],
        dishTypes: ["main course", "lunch"],
        healthLabels: ["High-Fiber", "Plant-Based"],
        extendedIngredients: [
          {
            original: "1 cup cooked quinoa",
            measures: { metric: { amount: 185, unitShort: "g" } },
          },
          {
            original: "1 cup roasted chickpeas",
            measures: { metric: { amount: 240, unitShort: "g" } },
          },
          {
            original: "2 cups mixed greens",
            measures: { metric: { amount: 100, unitShort: "g" } },
          },
          {
            original: "1 cup roasted sweet potato cubes",
            measures: { metric: { amount: 150, unitShort: "g" } },
          },
          {
            original: "½ avocado, sliced",
            measures: { metric: { amount: 50, unitShort: "g" } },
          },
        ],
        analyzedInstructions: [
          {
            steps: [
              {
                step: "Cook quinoa according to package directions and set aside to cool.",
              },
              {
                step: "Preheat oven to 400°F. Toss chickpeas with olive oil, cumin, and salt.",
              },
              {
                step: "Roast chickpeas for 20-25 minutes until crispy, stirring halfway through.",
              },
              {
                step: "Prepare sweet potatoes by cutting into cubes, tossing with oil and herbs.",
              },
              {
                step: "Roast sweet potatoes at 400°F for 25-30 minutes until tender.",
              },
              {
                step: "Assemble bowl: Start with greens, add quinoa, top with roasted vegetables.",
              },
              {
                step: "Add chickpeas, avocado slices, and drizzle with tahini dressing.",
              },
            ],
          },
        ],
        nutrition: {
          nutrients: [
            { name: "Calories", amount: 520 },
            { name: "Carbohydrates", amount: 68 },
            { name: "Protein", amount: 18 },
            { name: "Fat", amount: 19 },
          ],
        },
      },
      {
        id: 1000003,
        title: "Chicken Stir-Fry with Brown Rice",
        image: "https://spoonacular.com/recipeImages/1000003-312x231.jpg",
        summary:
          "Quick and healthy chicken stir-fry with colorful vegetables served over brown rice.",
        readyInMinutes: 20,
        servings: 4,
        vegan: false,
        vegetarian: false,
        diets: ["gluten free"],
        cuisines: ["Asian", "Chinese"],
        dishTypes: ["main course"],
        healthLabels: ["High-Protein", "Low-Fat"],
        extendedIngredients: [
          {
            original: "1.5 lbs chicken breast, sliced thin",
            measures: { metric: { amount: 680, unitShort: "g" } },
          },
          {
            original: "2 cups broccoli florets",
            measures: { metric: { amount: 300, unitShort: "g" } },
          },
          {
            original: "1 bell pepper, sliced",
            measures: { metric: { amount: 150, unitShort: "g" } },
          },
          {
            original: "2 tbsp low-sodium soy sauce",
            measures: { metric: { amount: 30, unitShort: "ml" } },
          },
          {
            original: "2 cups cooked brown rice",
            measures: { metric: { amount: 330, unitShort: "g" } },
          },
        ],
        analyzedInstructions: [
          {
            steps: [
              { step: "Prepare brown rice according to package directions." },
              {
                step: "Heat 1 tbsp oil in a large wok or skillet over high heat.",
              },
              {
                step: "Add chicken pieces and stir-fry for 6-7 minutes until golden. Set aside.",
              },
              {
                step: "Add another tbsp of oil and stir-fry broccoli for 3-4 minutes.",
              },
              {
                step: "Add bell pepper and cook for another 2-3 minutes until tender-crisp.",
              },
              {
                step: "Return chicken to wok, add soy sauce and ginger. Toss well.",
              },
              {
                step: "Serve stir-fry over fluffy brown rice. Enjoy hot!",
              },
            ],
          },
        ],
        nutrition: {
          nutrients: [
            { name: "Calories", amount: 420 },
            { name: "Carbohydrates", amount: 45 },
            { name: "Protein", amount: 38 },
            { name: "Fat", amount: 8 },
          ],
        },
      },
      {
        id: 1000004,
        title: "Mediterranean Pasta with Vegetables",
        image: "https://spoonacular.com/recipeImages/1000004-312x231.jpg",
        summary:
          "Whole wheat pasta tossed with fresh Mediterranean vegetables and herbs.",
        readyInMinutes: 20,
        servings: 2,
        vegan: true,
        vegetarian: true,
        diets: ["vegan", "vegetarian"],
        cuisines: ["Mediterranean", "Italian"],
        dishTypes: ["main course", "lunch"],
        healthLabels: ["High-Fiber", "Low-Fat"],
        extendedIngredients: [
          {
            original: "8 oz whole wheat pasta",
            measures: { metric: { amount: 227, unitShort: "g" } },
          },
          {
            original: "2 cups cherry tomatoes, halved",
            measures: { metric: { amount: 300, unitShort: "g" } },
          },
          {
            original: "1 cup diced cucumber",
            measures: { metric: { amount: 150, unitShort: "g" } },
          },
          {
            original: "¼ cup fresh basil",
            measures: { metric: { amount: 10, unitShort: "g" } },
          },
          {
            original: "3 tbsp extra virgin olive oil",
            measures: { metric: { amount: 45, unitShort: "ml" } },
          },
        ],
        analyzedInstructions: [
          {
            steps: [
              {
                step: "Bring a large pot of salted water to boil. Add whole wheat pasta.",
              },
              {
                step: "Cook pasta according to package directions until al dente.",
              },
              {
                step: "While pasta cooks, combine cherry tomatoes and cucumber in a large bowl.",
              },
              {
                step: "Drain pasta and add to the vegetable bowl while still warm.",
              },
              {
                step: "Drizzle with olive oil and add fresh basil, salt, and pepper.",
              },
              {
                step: "Toss everything together gently and serve immediately.",
              },
            ],
          },
        ],
        nutrition: {
          nutrients: [
            { name: "Calories", amount: 380 },
            { name: "Carbohydrates", amount: 52 },
            { name: "Protein", amount: 12 },
            { name: "Fat", amount: 16 },
          ],
        },
      },
      {
        id: 1000005,
        title: "Green Smoothie Bowl",
        image: "https://spoonacular.com/recipeImages/1000005-312x231.jpg",
        summary:
          "A nutrient-packed smoothie bowl with spinach, fruit, and granola toppings.",
        readyInMinutes: 10,
        servings: 1,
        vegan: true,
        vegetarian: true,
        diets: ["vegan", "gluten free"],
        cuisines: ["American", "Health Food"],
        dishTypes: ["breakfast"],
        healthLabels: ["High-Antioxidant", "Dairy-Free"],
        extendedIngredients: [
          {
            original: "2 cups fresh spinach",
            measures: { metric: { amount: 100, unitShort: "g" } },
          },
          {
            original: "1 banana",
            measures: { metric: { amount: 118, unitShort: "g" } },
          },
          {
            original: "1 cup frozen mango",
            measures: { metric: { amount: 150, unitShort: "g" } },
          },
          {
            original: "1 cup unsweetened almond milk",
            measures: { metric: { amount: 240, unitShort: "ml" } },
          },
          {
            original: "½ cup coconut milk",
            measures: { metric: { amount: 120, unitShort: "ml" } },
          },
        ],
        analyzedInstructions: [
          {
            steps: [
              {
                step: "Add spinach, banana, frozen mango, almond milk, and coconut milk to blender.",
              },
              {
                step: "Blend until smooth and creamy, about 1-2 minutes.",
              },
              {
                step: "Pour smoothie mixture into a bowl and create a thick texture.",
              },
              {
                step: "Top with granola, fresh berries, coconut flakes, and sliced banana.",
              },
              {
                step: "Drizzle with almond butter and eat with a spoon. Enjoy!",
              },
            ],
          },
        ],
        nutrition: {
          nutrients: [
            { name: "Calories", amount: 280 },
            { name: "Carbohydrates", amount: 52 },
            { name: "Protein", amount: 8 },
            { name: "Fat", amount: 6 },
          ],
        },
      },
      {
        id: 1000006,
        title: "Baked White Fish with Herbs",
        image: "https://spoonacular.com/recipeImages/1000006-312x231.jpg",
        summary:
          "Perfectly baked white fish fillet with fresh herbs and lemon.",
        readyInMinutes: 20,
        servings: 1,
        vegan: false,
        vegetarian: false,
        diets: ["gluten free", "dairy free"],
        cuisines: ["Mediterranean"],
        dishTypes: ["main course", "lunch"],
        healthLabels: ["High-Protein", "Low-Carb"],
        extendedIngredients: [
          {
            original: "6 oz white fish fillet",
            measures: { metric: { amount: 170, unitShort: "g" } },
          },
          {
            original: "2 tbsp fresh herbs (dill, parsley, chives)",
            measures: { metric: { amount: 10, unitShort: "g" } },
          },
          {
            original: "1 tbsp olive oil",
            measures: { metric: { amount: 15, unitShort: "ml" } },
          },
          {
            original: "1 lemon",
            measures: { metric: { amount: 1, unitShort: "" } },
          },
          {
            original: "Salt and white pepper to taste",
            measures: { metric: { amount: 1, unitShort: "tsp" } },
          },
        ],
        analyzedInstructions: [
          {
            steps: [
              {
                step: "Preheat oven to 400°F (200°C). Line a baking sheet with parchment paper.",
              },
              {
                step: "Place fish fillet on the prepared baking sheet.",
              },
              {
                step: "Drizzle with olive oil and sprinkle fresh herbs on top.",
              },
              {
                step: "Season with salt, white pepper, and squeeze of lemon juice.",
              },
              {
                step: "Bake for 12-15 minutes until fish is cooked through and flakes easily.",
              },
              {
                step: "Garnish with lemon wedges and fresh herb sprigs. Serve warm.",
              },
            ],
          },
        ],
        nutrition: {
          nutrients: [
            { name: "Calories", amount: 220 },
            { name: "Carbohydrates", amount: 2 },
            { name: "Protein", amount: 32 },
            { name: "Fat", amount: 10 },
          ],
        },
      },
    ];
  }

  /**
   * Check remaining API calls for today
   */
  async getRemainingCalls() {
    try {
      const today = new Date().toISOString().split("T")[0];
      let counter = await ApiRequestCounter.findOne({ date: today });

      if (!counter) {
        counter = await ApiRequestCounter.create({ date: today });
      }

      return {
        used: counter.generationCalls,
        limit: MAX_GENERATION_CALLS_PER_DAY,
        remaining: MAX_GENERATION_CALLS_PER_DAY - counter.generationCalls,
      };
    } catch (error) {
      console.error("[CALLS] Error getting remaining calls:", error);
      return {
        used: 0,
        limit: MAX_GENERATION_CALLS_PER_DAY,
        remaining: MAX_GENERATION_CALLS_PER_DAY,
      };
    }
  }
}

module.exports = new OptimizedRecipeService();
