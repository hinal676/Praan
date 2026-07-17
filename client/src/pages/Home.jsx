import React, { useEffect, useMemo, useState } from "react";
import Loader from "../components/Loader.jsx";
import RecipeCard from "../components/RecipeCard.jsx";
import RecipeModal from "../components/RecipeModal.jsx";
import { clientCacheService } from "../services/cacheService.js";
import { recipeService } from "../services/recipeService.js";

const SAVED_RECIPES_CACHE_KEY = "user:savedRecipes";

const initialFormState = {
  dietaryPreferences: ["veg"],
  allergies: [],
  healthConditions: [],
  deficiencies: [],
  cuisinePreference: "indian",
  cookingTime: "15-30min",
  basicDetails: {
    age: "",
    gender: "",
    weight: "",
    height: "",
  },
};

const optionGroups = {
  dietaryPreferences: ["veg", "non-veg", "vegan"],
  allergies: ["nuts", "dairy", "gluten", "shellfish", "none"],
  healthConditions: [
    "diabetes",
    "cholesterol",
    "pcos",
    "anaemia",
    "thyroid",
    "none",
  ],
  deficiencies: ["iron", "calcium", "vitamin-d", "protein", "none"],
};

function setExclusiveGroup(previous, field, value) {
  const current = previous[field] || [];
  const hasValue = current.includes(value);

  if (field === "dietaryPreferences") {
    return hasValue ? [] : [value];
  }

  if (value === "none") {
    return hasValue ? [] : ["none"];
  }

  if (current.includes("none")) {
    return [value];
  }

  return hasValue
    ? current.filter((item) => item !== value)
    : [...current, value];
}

function buildPreferences(formState) {
  return {
    healthConditions: formState.healthConditions,
    dietaryPreferences: formState.dietaryPreferences,
    allergies: formState.allergies,
    deficiencies: formState.deficiencies,
    cuisinePreference: formState.cuisinePreference,
    cookingTime: formState.cookingTime,
    basicDetails: {
      age: parseInt(formState.basicDetails.age, 10) || null,
      gender: formState.basicDetails.gender,
      weight: parseInt(formState.basicDetails.weight, 10) || null,
      height: parseInt(formState.basicDetails.height, 10) || null,
    },
  };
}

export default function HomePage({ token }) {
  const [formState, setFormState] = useState(initialFormState);
  const [generatedRecipes, setGeneratedRecipes] = useState([]);
  const [savedRecipeIds, setSavedRecipeIds] = useState(new Set());
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);

  const preferences = useMemo(() => buildPreferences(formState), [formState]);

  const cacheKey = useMemo(
    () => clientCacheService.generateKey("edamam:recipes", preferences),
    [preferences],
  );

  const isRecipeSaved = (recipe) => {
    const recipeId = recipeService.getRecipeIdentity(recipe);
    return recipeId ? savedRecipeIds.has(recipeId) : false;
  };

  const syncSavedIds = (recipes) => {
    setSavedRecipeIds(
      new Set(
        recipes
          .map((recipe) => recipeService.getRecipeIdentity(recipe))
          .filter(Boolean),
      ),
    );
  };

  useEffect(() => {
    let isActive = true;

    const loadSavedRecipes = async () => {
      if (!token) {
        return;
      }

      const cachedSavedRecipes = clientCacheService.get(
        SAVED_RECIPES_CACHE_KEY,
      );
      if (Array.isArray(cachedSavedRecipes)) {
        syncSavedIds(cachedSavedRecipes);
        return;
      }

      setIsLoadingSaved(true);

      try {
        const savedRecipes = await recipeService.getSavedRecipes(token);
        if (!isActive) return;

        syncSavedIds(savedRecipes);
        clientCacheService.set(
          SAVED_RECIPES_CACHE_KEY,
          savedRecipes,
          5 * 60 * 1000,
        );
      } catch (error) {
        if (!isActive) return;
        console.error("Saved recipes load error:", error);
      } finally {
        if (isActive) {
          setIsLoadingSaved(false);
        }
      }
    };

    loadSavedRecipes();

    return () => {
      isActive = false;
    };
  }, [token]);

  const updateCheckboxGroup = (field, value) => {
    setFormState((previous) => ({
      ...previous,
      [field]: setExclusiveGroup(previous, field, value),
    }));
  };

  const updateSingleField = (field, value) => {
    setFormState((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const updateBasicField = (field, value) => {
    setFormState((previous) => ({
      ...previous,
      basicDetails: {
        ...previous.basicDetails,
        [field]: value,
      },
    }));
  };

  const openRecipe = (recipe) => {
    setSelectedRecipe(recipe);
  };

  const closeRecipe = () => {
    setSelectedRecipe(null);
  };

  const handleSaveRecipe = async (recipe) => {
    if (!token || !recipe) {
      return;
    }

    try {
      await recipeService.saveRecipe(token, recipe);
      const updatedSavedRecipes = await recipeService.getSavedRecipes(token);
      syncSavedIds(updatedSavedRecipes);
      clientCacheService.delete(SAVED_RECIPES_CACHE_KEY);
      setStatus({ type: "success", message: "Recipe saved to favorites!" });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Error saving recipe.",
      });
    }
  };

  const handleGenerateRecipes = async (event) => {
    event.preventDefault();
    setStatus({ type: "", message: "" });

    const cachedRecipes = clientCacheService.get(cacheKey);
    if (Array.isArray(cachedRecipes) && cachedRecipes.length > 0) {
      setGeneratedRecipes(cachedRecipes);
      setStatus({ type: "success", message: "Loaded recipes from cache." });
      return;
    }

    setIsGenerating(true);

    try {
      const response = await recipeService.generateRecipes(token, preferences);
      const recipes = Array.isArray(response.data) ? response.data : [];

      if (!response.success || recipes.length === 0) {
        throw new Error(response.message || "Failed to generate recipes");
      }

      clientCacheService.set(cacheKey, recipes, "EDAMAM_RECIPES");
      setGeneratedRecipes(recipes);
      setStatus({
        type: "success",
        message: response.message || "Recipes generated successfully.",
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Error generating recipes. Please try again.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleWatchTutorial = async (recipe) => {
    if (!recipe) return;

    const existingVideoUrl = recipeService.getRecipeVideoUrl(recipe);

    if (existingVideoUrl) {
      window.open(
        recipeService.toYouTubeWatchUrl(existingVideoUrl),
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }

    try {
      const response = await recipeService.searchYouTubeVideo(recipe.title);

      if (
        !response.success ||
        !Array.isArray(response.data) ||
        response.data.length === 0
      ) {
        throw new Error(
          response.message || "No tutorial found for this recipe right now.",
        );
      }

      const updatedRecipe = {
        ...recipe,
        youtubeVideo: response.data[0],
      };
      setSelectedRecipe(updatedRecipe);
      window.open(
        recipeService.toYouTubeWatchUrl(
          recipeService.getRecipeVideoUrl(updatedRecipe),
        ),
        "_blank",
        "noopener,noreferrer",
      );
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Could not load tutorial video.",
      });
    }
  };

  const recipeCards = generatedRecipes.length > 0 ? generatedRecipes : [];

  return (
    <div>
      <div className="landing-header">
        <div>
          <div className="landing-kicker">Personalized Generator</div>
          <h1>Generate My Recipe</h1>
          <p className="tagline">
            Tell us about your health profile and we&apos;ll create a recipe
            that&apos;s safe and nutritious for you.
          </p>
        </div>
      </div>

      <form
        className="preferences-form landing-form"
        onSubmit={handleGenerateRecipes}
      >
        <div className="landing-grid">
          <section className="landing-card step-card">
            <div className="step-head">
              <span className="step-no">1</span>
              <div>
                <h3>Dietary Preferences</h3>
                <p>Select your primary diet type</p>
              </div>
            </div>
            <div className="option-row option-row-3">
              {optionGroups.dietaryPreferences.map((value) => (
                <label className="option-tile" key={value}>
                  <input
                    className="choice-input"
                    type="checkbox"
                    checked={formState.dietaryPreferences.includes(value)}
                    onChange={(event) => {
                      if (event.target.checked) {
                        updateCheckboxGroup("dietaryPreferences", value);
                      } else {
                        updateCheckboxGroup("dietaryPreferences", value);
                      }
                    }}
                  />
                  <span className="tile-label">
                    {value === "veg"
                      ? "Vegetarian"
                      : value === "non-veg"
                        ? "Non-Vegetarian"
                        : "Vegan"}
                  </span>
                  <span className="tile-note">
                    {value === "veg"
                      ? "No meat or seafood"
                      : value === "non-veg"
                        ? "Includes meat and fish"
                        : "No animal products"}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="landing-card step-card">
            <div className="step-head">
              <span className="step-no">2</span>
              <div>
                <h3>Allergies</h3>
                <p>Select all that apply</p>
              </div>
            </div>
            <div className="option-row option-row-5 compact-tiles">
              {optionGroups.allergies.map((value) => (
                <label className="option-tile compact" key={value}>
                  <input
                    className="choice-input"
                    type="checkbox"
                    checked={formState.allergies.includes(value)}
                    onChange={() => updateCheckboxGroup("allergies", value)}
                  />
                  <span className="tile-label">
                    {value === "none"
                      ? "None"
                      : value.charAt(0).toUpperCase() + value.slice(1)}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="landing-card step-card">
            <div className="step-head">
              <span className="step-no">3</span>
              <div>
                <h3>Basic Details</h3>
                <p>Helps us calculate nutritional requirements</p>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group form-col-2">
                <label htmlFor="age">Age (years)</label>
                <input
                  type="number"
                  id="age"
                  min="1"
                  max="150"
                  placeholder="28"
                  value={formState.basicDetails.age}
                  onChange={(event) =>
                    updateBasicField("age", event.target.value)
                  }
                />
              </div>
              <div className="form-group form-col-2">
                <label htmlFor="gender">Gender</label>
                <select
                  id="gender"
                  value={formState.basicDetails.gender}
                  onChange={(event) =>
                    updateBasicField("gender", event.target.value)
                  }
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group form-col-2">
                <label htmlFor="weight">Weight (kg)</label>
                <input
                  type="number"
                  id="weight"
                  min="1"
                  placeholder="62"
                  value={formState.basicDetails.weight}
                  onChange={(event) =>
                    updateBasicField("weight", event.target.value)
                  }
                />
              </div>
              <div className="form-group form-col-2">
                <label htmlFor="height">Height (cm)</label>
                <input
                  type="number"
                  id="height"
                  min="1"
                  placeholder="165"
                  value={formState.basicDetails.height}
                  onChange={(event) =>
                    updateBasicField("height", event.target.value)
                  }
                />
              </div>
            </div>
          </section>

          <section className="landing-card step-card">
            <div className="step-head">
              <span className="step-no">4</span>
              <div>
                <h3>Health Conditions</h3>
                <p>Recipes tailored for your condition</p>
              </div>
            </div>
            <div className="option-row option-row-3 compact-tiles">
              {optionGroups.healthConditions.map((value) => (
                <label className="option-tile compact wide" key={value}>
                  <input
                    className="choice-input"
                    type="checkbox"
                    checked={formState.healthConditions.includes(value)}
                    onChange={() =>
                      updateCheckboxGroup("healthConditions", value)
                    }
                  />
                  <span className="tile-label">
                    {value === "none"
                      ? "None / Healthy"
                      : value === "pcos"
                        ? "PCOD / PCOS"
                        : value.charAt(0).toUpperCase() + value.slice(1)}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="landing-card step-card">
            <div className="step-head">
              <span className="step-no">5</span>
              <div>
                <h3>Nutritional Deficiencies</h3>
                <p>We&apos;ll boost recipes with nutrients you need</p>
              </div>
            </div>
            <div className="option-row option-row-5 compact-tiles">
              {optionGroups.deficiencies.map((value) => (
                <label className="option-tile compact" key={value}>
                  <input
                    className="choice-input"
                    type="checkbox"
                    checked={formState.deficiencies.includes(value)}
                    onChange={() => updateCheckboxGroup("deficiencies", value)}
                  />
                  <span className="tile-label">
                    {value === "vitamin-d"
                      ? "Vitamin D"
                      : value === "none"
                        ? "None"
                        : value.charAt(0).toUpperCase() + value.slice(1)}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="landing-card step-card">
            <div className="step-head">
              <span className="step-no">6</span>
              <div>
                <h3>Cuisine Preference</h3>
                <p>Choose the cooking style you prefer</p>
              </div>
            </div>
            <div
              className="option-row option-row-5 compact-tiles single-select"
              data-select-target="cuisine"
            >
              {[
                ["indian", "Indian", "IN"],
                ["italian", "Italian", "IT"],
                ["chinese", "Chinese", "CN"],
                ["mexican", "Mexican", "MX"],
                ["thai", "Any Cuisine", "🌍"],
              ].map(([value, label, short]) => (
                <button
                  className={`option-tile compact select-option ${formState.cuisinePreference === value ? "active" : ""}`}
                  key={value}
                  type="button"
                  data-value={value}
                  onClick={() => updateSingleField("cuisinePreference", value)}
                >
                  <span className="tile-label">{short}</span>
                  <span className="tile-note">{label}</span>
                </button>
              ))}
            </div>
            <select
              id="cuisine"
              className="hidden-select"
              value={formState.cuisinePreference}
              onChange={(event) =>
                updateSingleField("cuisinePreference", event.target.value)
              }
            >
              <option value="indian">Indian</option>
              <option value="italian">Italian</option>
              <option value="chinese">Chinese</option>
              <option value="mexican">Mexican</option>
              <option value="thai">Any Cuisine</option>
            </select>
          </section>

          <section className="landing-card step-card landing-card-wide">
            <div className="step-head">
              <span className="step-no">7</span>
              <div>
                <h3>Available Cooking Time</h3>
                <p>We&apos;ll match recipes to fit your schedule</p>
              </div>
            </div>
            <div
              className="option-row option-row-4 compact-tiles single-select"
              data-select-target="cookingTime"
            >
              {[
                ["<15min", "Under 15 min", "⚡"],
                ["15-30min", "15-30 min", "🕑"],
                ["30-45min", "30-45 min", "🕒"],
                [">45min", "Over 45 min", "🕓"],
              ].map(([value, label, icon]) => (
                <button
                  className={`option-tile compact select-option ${formState.cookingTime === value ? "active" : ""}`}
                  key={value}
                  type="button"
                  data-value={value}
                  onClick={() => updateSingleField("cookingTime", value)}
                >
                  <span className="tile-icon">{icon}</span>
                  <span className="tile-label">{label}</span>
                </button>
              ))}
            </div>
            <select
              id="cookingTime"
              className="hidden-select"
              value={formState.cookingTime}
              onChange={(event) =>
                updateSingleField("cookingTime", event.target.value)
              }
            >
              <option value="<15min">&lt;15 min</option>
              <option value="15-30min">15-30 min</option>
              <option value="30-45min">30-45 min</option>
              <option value=">45min">&gt;45 min</option>
            </select>
          </section>
        </div>

        <div className="landing-submit-wrap">
          <button
            type="submit"
            className="btn btn-primary btn-large landing-submit-btn"
            disabled={isGenerating}
          >
            {isGenerating ? "Generating..." : "Generate My Recipe"}
          </button>
        </div>
        <p className={`profile-status ${status.type}`} aria-live="polite">
          {status.message}
        </p>
      </form>

      {isLoadingSaved ? <Loader /> : null}

      <div className="recipes-container">
        {recipeCards.map((recipe) => (
          <RecipeCard
            key={recipeService.getRecipeIdentity(recipe)}
            recipe={recipe}
            isSaved={isRecipeSaved(recipe)}
            onOpen={openRecipe}
            onSave={handleSaveRecipe}
          />
        ))}
      </div>

      <RecipeModal
        recipe={selectedRecipe}
        isSaved={selectedRecipe ? isRecipeSaved(selectedRecipe) : false}
        onClose={closeRecipe}
        onSave={handleSaveRecipe}
        onWatchTutorial={handleWatchTutorial}
      />
    </div>
  );
}
