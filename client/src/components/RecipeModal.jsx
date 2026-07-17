import React, { useEffect, useState } from "react";
import {
  cleanHTMLText,
  extractNutrition,
  getAvoidRecommendations,
  getRecipeIdentity,
  getRecipeVideoUrl,
  normalizeRecipeInstructions,
  toYouTubeWatchUrl,
} from "../utils/recipeHelpers.js";

export default function RecipeModal({
  recipe,
  isSaved,
  onClose,
  onSave,
  onWatchTutorial,
}) {
  const [activeTab, setActiveTab] = useState("ingredients");

  useEffect(() => {
    setActiveTab("ingredients");
  }, [recipe]);

  if (!recipe) {
    return null;
  }

  const nutrition = extractNutrition(recipe);
  const prepTime = recipe.prepTime || 15;
  const cookTime = recipe.cookTime || 20;
  const totalTime = prepTime + cookTime;
  const servings = recipe.servings || 2;
  const normalizedInstructions = normalizeRecipeInstructions(recipe);
  const videoUrl = getRecipeVideoUrl(recipe);

  return (
    <div className="modal" onClick={onClose}>
      <div
        className="modal-content recipe-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="close-btn" type="button" onClick={onClose}>
          &times;
        </button>
        <div className="recipe-detail">
          <div className="recipe-hero">
            <img
              src={recipe.image}
              alt={recipe.title}
              className="recipe-image"
            />
            <div className="recipe-hero-overlay">
              <div className="recipe-badges">
                {(recipe.tags || []).map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
              <h2>{recipe.title}</h2>
              <p className="recipe-subtitle">
                {cleanHTMLText(recipe.description) ||
                  "A nutrient-dense dish with balanced macros and health-focused ingredients."}
              </p>
            </div>
          </div>

          <div className="recipe-meta recipe-meta-clone">
            <div className="meta-chip">
              <span className="meta-value">{prepTime}m</span>
              <span className="meta-label">Prep</span>
            </div>
            <div className="meta-chip">
              <span className="meta-value">{cookTime}m</span>
              <span className="meta-label">Cook</span>
            </div>
            <div className="meta-chip">
              <span className="meta-value">{totalTime}m</span>
              <span className="meta-label">Total</span>
            </div>
            <div className="meta-chip">
              <span className="meta-value">{servings}</span>
              <span className="meta-label">Serves</span>
            </div>
          </div>

          <div className="recipe-nutrition recipe-nutrition-clone">
            <div className="nutrition-item nutrition-calories">
              <span className="nutrition-value">{nutrition.calories}</span>
              <span className="nutrition-unit">kcal</span>
              <span className="nutrition-label">Calories</span>
            </div>
            <div className="nutrition-item nutrition-protein">
              <span className="nutrition-value">{nutrition.protein}</span>
              <span className="nutrition-unit">g</span>
              <span className="nutrition-label">Protein</span>
            </div>
            <div className="nutrition-item nutrition-carbs">
              <span className="nutrition-value">{nutrition.carbs}</span>
              <span className="nutrition-unit">g</span>
              <span className="nutrition-label">Carbs</span>
            </div>
            <div className="nutrition-item nutrition-fat">
              <span className="nutrition-value">{nutrition.fat}</span>
              <span className="nutrition-unit">g</span>
              <span className="nutrition-label">Fat</span>
            </div>
            <div className="nutrition-item nutrition-fiber">
              <span className="nutrition-value">{nutrition.fiber}</span>
              <span className="nutrition-unit">g</span>
              <span className="nutrition-label">Fiber</span>
            </div>
          </div>

          <div className="recipe-content-tabs">
            {[
              ["ingredients", "Ingredients"],
              ["instructions", "Instructions"],
              ["avoid", "Who to Avoid"],
            ].map(([tab, label]) => (
              <button
                key={tab}
                className={`recipe-content-tab ${activeTab === tab ? "active" : ""}`}
                type="button"
                onClick={() => setActiveTab(tab)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="recipe-quick-actions">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => onWatchTutorial?.(recipe)}
            >
              {videoUrl
                ? "▶ Open Tutorial on YouTube"
                : "▶ Find Tutorial on YouTube"}
            </button>
          </div>

          <section
            className={`recipe-tab-panel ${activeTab === "ingredients" ? "active" : ""}`}
          >
            <ul className="ingredients-list">
              {(recipe.ingredients || []).map((ingredient) => (
                <li
                  key={
                    typeof ingredient === "string"
                      ? ingredient
                      : ingredient.name
                  }
                >
                  {typeof ingredient === "string"
                    ? ingredient
                    : ingredient.name || ingredient}
                </li>
              ))}
            </ul>
          </section>

          <section
            className={`recipe-tab-panel ${activeTab === "instructions" ? "active" : ""}`}
          >
            <ol className="instructions-list">
              {normalizedInstructions.length > 0 ? (
                normalizedInstructions.map((step) => <li key={step}>{step}</li>)
              ) : (
                <li>Instructions are currently unavailable for this recipe.</li>
              )}
            </ol>
          </section>

          <section
            className={`recipe-tab-panel ${activeTab === "avoid" ? "active" : ""}`}
          >
            <ul className="avoid-list">
              {getAvoidRecommendations(recipe).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <div className="recipe-actions">
            <button
              className={`btn btn-primary ${isSaved ? "saved" : ""}`}
              type="button"
              disabled={isSaved}
              onClick={() => onSave?.(recipe)}
            >
              {isSaved ? "💗 Saved" : "❤️ Save to Favorites"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
