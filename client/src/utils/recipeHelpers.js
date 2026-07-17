export function getRecipeIdentity(recipe) {
  return String(recipe?.recipeId || recipe?.id || recipe?._id || "").trim();
}

export function extractNutrition(recipe) {
  const nutrition = {
    calories: 320,
    protein: 15,
    carbs: 45,
    fat: 8,
    fiber: 9,
  };

  if (recipe?.nutrition && Array.isArray(recipe.nutrition)) {
    recipe.nutrition.forEach((nutrient) => {
      if (nutrient.name === "Calories")
        nutrition.calories = Math.round(nutrient.amount);
      else if (nutrient.name === "Protein")
        nutrition.protein = Math.round(nutrient.amount);
      else if (nutrient.name === "Carbohydrates")
        nutrition.carbs = Math.round(nutrient.amount);
      else if (nutrient.name === "Fat")
        nutrition.fat = Math.round(nutrient.amount);
      else if (nutrient.name === "Fiber")
        nutrition.fiber = Math.round(nutrient.amount);
    });
  } else if (recipe?.nutrition && typeof recipe.nutrition === "object") {
    nutrition.calories = Math.round(
      recipe.nutrition.calories || nutrition.calories,
    );
    nutrition.protein = Math.round(
      recipe.nutrition.protein || nutrition.protein,
    );
    nutrition.carbs = Math.round(recipe.nutrition.carbs || nutrition.carbs);
    nutrition.fat = Math.round(recipe.nutrition.fat || nutrition.fat);
    nutrition.fiber = Math.round(recipe.nutrition.fiber || nutrition.fiber);
  }

  return nutrition;
}

export function normalizeRecipeInstructions(recipe) {
  const rawInstructions = recipe?.instructions;

  if (Array.isArray(rawInstructions)) {
    return rawInstructions
      .map((step) => (typeof step === "string" ? step : step?.step || ""))
      .map((step) => step.trim())
      .filter(Boolean);
  }

  if (typeof rawInstructions === "string" && rawInstructions.trim()) {
    const html = rawInstructions;
    const listItems =
      html
        .match(/<li[^>]*>(.*?)<\/li>/gi)
        ?.map((item) => item.replace(/<[^>]+>/g, "").trim())
        .filter(Boolean) || [];

    if (listItems.length > 0) {
      return listItems;
    }

    return html
      .replace(/<[^>]+>/g, " ")
      .split(/\r?\n|\.(?=\s)/)
      .map((step) => step.trim())
      .filter(Boolean);
  }

  return [];
}

export function cleanHTMLText(html) {
  if (!html || typeof html !== "string") {
    return "";
  }

  const stripped = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.substring(0, 200) + (stripped.length > 200 ? "..." : "");
}

export function getAvoidRecommendations(recipe) {
  if (Array.isArray(recipe?.whoToAvoid) && recipe.whoToAvoid.length) {
    return recipe.whoToAvoid;
  }

  const tagsText = (recipe?.tags || []).join(" ").toLowerCase();
  const ingredientsText = (recipe?.ingredients || [])
    .map((item) => (typeof item === "string" ? item : item.name || ""))
    .join(" ")
    .toLowerCase();

  const warnings = [];

  if (ingredientsText.includes("nuts") || ingredientsText.includes("almond")) {
    warnings.push("People with tree-nut allergies should avoid this recipe.");
  }

  if (ingredientsText.includes("dairy") || ingredientsText.includes("cheese")) {
    warnings.push("Avoid if you are lactose-intolerant or dairy-sensitive.");
  }

  if (tagsText.includes("iron") || ingredientsText.includes("spinach")) {
    warnings.push(
      "Those with kidney stone risk should moderate high-oxalate ingredients.",
    );
  }

  if (ingredientsText.includes("avocado") || ingredientsText.includes("beet")) {
    warnings.push(
      "Individuals on potassium-restricted diets should consume with caution.",
    );
  }

  if (!warnings.length) {
    warnings.push(
      "No major avoid list found. Please review ingredients for personal allergies.",
    );
  }

  return warnings;
}

export function getRecipeVideoUrl(recipe) {
  return (
    recipe?.youtubeVideo?.embeddedUrl ||
    recipe?.youtubeVideo?.url ||
    recipe?.youtubeVideoUrl ||
    recipe?.videoUrl ||
    ""
  );
}

export function toYouTubeWatchUrl(videoUrl) {
  if (!videoUrl) return "";

  if (videoUrl.includes("youtube.com/embed/")) {
    const videoId = videoUrl.split("/embed/")[1]?.split("?")[0];
    return videoId ? `https://www.youtube.com/watch?v=${videoId}` : videoUrl;
  }

  return videoUrl;
}

export function getRecipeTagClass(tag) {
  let tagClass = "recipe-tag-new";
  const normalizedTag = String(tag || "").toLowerCase();

  if (normalizedTag.includes("diabetic")) tagClass += " diabetic";
  else if (normalizedTag.includes("iron") || normalizedTag.includes("anaemia"))
    tagClass += " iron-rich";
  else if (normalizedTag.includes("thyroid")) tagClass += " thyroid";
  else if (normalizedTag.includes("pcos")) tagClass += " pcos";
  else if (normalizedTag.includes("vegan")) tagClass += " vegan";
  else if (normalizedTag.includes("cholesterol")) tagClass += " cholesterol";
  else if (normalizedTag.includes("protein")) tagClass += " protein";
  else if (normalizedTag.includes("vegetarian")) tagClass += " vegetarian";

  return tagClass;
}
