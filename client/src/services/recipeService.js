import { request } from "./api.js";

export const recipeService = {
  getHealthyRecipes(token, params = {}) {
    const query = new URLSearchParams(params).toString();

    return request(`/recipes/healthy${query ? `?${query}` : ""}`, {
      method: "GET",
      token,
    });
  },
  generateRecipes(token, preferences) {
    return request("/recipes/generate", {
      method: "POST",
      token,
      body: preferences,
    });
  },
  getSavedRecipes(token) {
    return request("/recipes/saved", {
      method: "GET",
      token,
    }).then((payload) => (Array.isArray(payload.data) ? payload.data : []));
  },
  saveRecipe(token, recipe) {
    return request("/recipes/save", {
      method: "POST",
      token,
      body: recipeService.normalizeSavedRecipe(recipe),
    });
  },
  removeSavedRecipe(token, recipeId) {
    return request(`/recipes/saved/${recipeId}`, {
      method: "DELETE",
      token,
    });
  },
  searchYouTubeVideo(recipeName) {
    return request("/recipes/youtube-video", {
      method: "POST",
      body: { recipeName },
    });
  },
  getRecipeIdentity(recipe) {
    return String(recipe?.recipeId || recipe?.id || recipe?._id || "").trim();
  },
  getRecipeVideoUrl(recipe) {
    return (
      recipe?.youtubeVideo?.embeddedUrl ||
      recipe?.youtubeVideo?.url ||
      recipe?.youtubeVideoUrl ||
      recipe?.videoUrl ||
      ""
    );
  },
  toYouTubeWatchUrl(videoUrl) {
    if (!videoUrl) return "";

    if (videoUrl.includes("youtube.com/embed/")) {
      const videoId = videoUrl.split("/embed/")[1]?.split("?")[0];
      return videoId ? `https://www.youtube.com/watch?v=${videoId}` : videoUrl;
    }

    return videoUrl;
  },
  normalizeSavedRecipe(recipe) {
    const nutrition = Array.isArray(recipe.nutrition)
      ? recipe.nutrition.reduce(
          (accumulator, nutrient) => {
            if (nutrient.name === "Calories")
              accumulator.calories = Math.round(nutrient.amount);
            if (nutrient.name === "Protein")
              accumulator.protein = Math.round(nutrient.amount);
            if (nutrient.name === "Carbohydrates")
              accumulator.carbs = Math.round(nutrient.amount);
            if (nutrient.name === "Fat")
              accumulator.fat = Math.round(nutrient.amount);
            if (nutrient.name === "Fiber")
              accumulator.fiber = Math.round(nutrient.amount);
            return accumulator;
          },
          { calories: 320, protein: 15, carbs: 45, fat: 8, fiber: 9 },
        )
      : recipe.nutrition || {
          calories: 320,
          protein: 15,
          carbs: 45,
          fat: 8,
          fiber: 9,
        };

    const ingredients = Array.isArray(recipe.ingredients)
      ? recipe.ingredients.map((item) => {
          if (typeof item === "string") {
            return { name: item, amount: null, unit: "" };
          }

          return {
            name: item?.name || item?.original || "",
            amount: Number(item?.amount) || null,
            unit: item?.unit || "",
          };
        })
      : [];

    const instructions = Array.isArray(recipe.instructions)
      ? recipe.instructions
          .map((step) => (typeof step === "string" ? step : step?.step || ""))
          .filter(Boolean)
      : [];

    return {
      recipeId: recipeService.getRecipeIdentity(recipe),
      title: recipe.title,
      image: recipe.image,
      tags: recipe.tags || [],
      suitableFor:
        recipe.suitableFor || recipe.healthBenefits?.suitableFor || [],
      avoidFor: recipe.avoidFor || recipe.healthBenefits?.avoidFor || [],
      description: recipe.description || recipe.summary || "",
      prepTime: Number(recipe.prepTime) || 0,
      cookTime: Number(recipe.cookTime) || 0,
      servings: Number(recipe.servings) || 0,
      ingredients,
      instructions,
      nutrition,
    };
  },
};
