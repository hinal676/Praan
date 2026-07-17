import React from "react";
import {
  extractNutrition,
  getRecipeIdentity,
  getRecipeTagClass,
} from "../utils/recipeHelpers.js";

export default function RecipeCard({
  recipe,
  isSaved,
  showRemoveButton,
  onOpen,
  onSave,
  onRemove,
}) {
  const nutrition = extractNutrition(recipe);
  const cuisine = recipe.cuisine || "Indian";
  const duration = (recipe.prepTime || 0) + (recipe.cookTime || 0);
  const difficulty = recipe.difficulty || "Medium";
  const recipeId = getRecipeIdentity(recipe);
  const tags = (recipe.tags || []).slice(0, 3);

  return (
    <div
      className="recipe-card-new"
      onClick={() => onOpen?.(recipe)}
      role="button"
      tabIndex={0}
    >
      <div className="recipe-card-new-image-wrapper">
        <img
          src={recipe.image}
          alt={recipe.title}
          className="recipe-card-new-image"
        />
        <span className="recipe-cuisine-badge">{cuisine}</span>
        <button
          className={`recipe-save-btn${isSaved ? " saved" : ""}`}
          type="button"
          data-recipe-id={recipeId}
          title={isSaved ? "Saved recipe" : "Save recipe"}
          aria-pressed={isSaved}
          disabled={isSaved}
          onClick={(event) => {
            event.stopPropagation();
            onSave?.(recipe);
          }}
        >
          {isSaved ? "💗" : "🤍"}
        </button>
      </div>
      <div className="recipe-card-new-content">
        <h3 className="recipe-card-new-title">{recipe.title}</h3>
        {showRemoveButton ? (
          <div className="recipe-card-actions">
            <button
              type="button"
              className="recipe-remove-btn"
              onClick={(event) => {
                event.stopPropagation();
                onRemove?.(recipe);
              }}
            >
              Remove from favourites
            </button>
          </div>
        ) : null}
        <div className="recipe-card-new-tags">
          {tags.map((tag) => (
            <span key={tag} className={getRecipeTagClass(tag)}>
              {tag}
            </span>
          ))}
        </div>
        <div className="recipe-nutrition-grid">
          <div className="nutrition-item">
            <div className="nutrition-value">{nutrition.calories}</div>
            <div className="nutrition-label">Cal</div>
          </div>
          <div className="nutrition-item">
            <div className="nutrition-value">{nutrition.protein}g</div>
            <div className="nutrition-label">Protein</div>
          </div>
          <div className="nutrition-item">
            <div className="nutrition-value">{nutrition.carbs}g</div>
            <div className="nutrition-label">Carbs</div>
          </div>
          <div className="nutrition-item">
            <div className="nutrition-value">{nutrition.fat}g</div>
            <div className="nutrition-label">Fat</div>
          </div>
        </div>
        <div className="recipe-card-new-meta">
          <span className="recipe-meta-item">
            🕒 <strong>{duration}</strong> min
          </span>
          <span className="recipe-meta-item">
            📊 <strong>{difficulty}</strong>
          </span>
          <span className="recipe-meta-item">
            ⚡ <strong>{nutrition.calories}</strong> kcal
          </span>
        </div>
      </div>
    </div>
  );
}
