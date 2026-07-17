import React, { useEffect, useMemo, useState } from "react";
import Loader from "../components/Loader.jsx";
import RecipeCard from "../components/RecipeCard.jsx";
import RecipeModal from "../components/RecipeModal.jsx";
import { clientCacheService } from "../services/cacheService.js";
import { recipeService } from "../services/recipeService.js";

const SAVED_RECIPES_CACHE_KEY = "user:savedRecipes";
const DISCOVER_CACHE_KEY = clientCacheService.generateKey(
  "spoonacular:healthy",
  {
    limit: 12,
  },
);

const DISCOVER_TEST_RECIPES = [
  {
    id: "mock-discover-1",
    title: "Methi Moong Chilla Bowl",
    description:
      "Protein-forward breakfast with fenugreek and sprouts for glycemic balance.",
    image:
      "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=1200&q=80",
    cuisine: "Indian",
    prepTime: 12,
    cookTime: 10,
    difficulty: "Easy",
    servings: 2,
    tags: ["Diabetic-Friendly", "Protein Rich", "Vegetarian"],
    ingredients: [
      "1 cup soaked moong dal",
      "1 tbsp chopped methi leaves",
      "1 tsp grated ginger",
      "1 tsp cumin",
      "Salt and pepper",
    ],
    instructions: [
      "Blend soaked moong dal into a smooth batter.",
      "Mix methi, ginger, cumin, and seasoning into the batter.",
      "Spread on a hot tawa and cook both sides until golden.",
      "Serve with sauteed vegetables and mint yogurt.",
    ],
    whoToAvoid: [
      "People with severe legume allergies should avoid this recipe.",
    ],
    nutrition: [
      { name: "Calories", amount: 298 },
      { name: "Protein", amount: 18 },
      { name: "Carbohydrates", amount: 32 },
      { name: "Fat", amount: 9 },
      { name: "Fiber", amount: 11 },
    ],
  },
  {
    id: "mock-discover-2",
    title: "Iron Boost Beetroot Millet Salad",
    description:
      "Millet, beetroot, and spinach salad designed for improved iron intake.",
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80",
    cuisine: "Fusion",
    prepTime: 15,
    cookTime: 20,
    difficulty: "Medium",
    servings: 3,
    tags: ["Iron-Rich", "Anaemia Support", "Vegan"],
    ingredients: [
      "1 cup cooked foxtail millet",
      "1 small beetroot, roasted and diced",
      "1 cup baby spinach",
      "1 tbsp pumpkin seeds",
      "1/2 cup boiled chickpeas",
      "1/4 avocado, sliced",
      "1 tbsp chopped parsley",
      "1 tbsp pomegranate arils",
      "1 tsp sesame seeds",
      "1 tbsp olive oil",
      "1 tbsp lemon juice",
      "1 tsp tahini",
      "1/2 tsp black pepper",
      "Pink salt to taste",
    ],
    instructions: [
      "Roast beetroot until tender and chop into cubes.",
      "Whisk olive oil, lemon juice, tahini, pepper, and salt into a dressing.",
      "Add millet, spinach, and chickpeas to a large mixing bowl.",
      "Fold in beetroot, avocado, and parsley gently.",
      "Top with pumpkin seeds, sesame seeds, and pomegranate arils.",
      "Drizzle dressing and toss lightly before serving.",
      "Let it rest for 5 minutes so flavors blend.",
    ],
    whoToAvoid: [
      "Those with oxalate restrictions should moderate beetroot and spinach intake.",
    ],
    nutrition: [
      { name: "Calories", amount: 342 },
      { name: "Protein", amount: 12 },
      { name: "Carbohydrates", amount: 48 },
      { name: "Fat", amount: 11 },
      { name: "Fiber", amount: 10 },
    ],
  },
  {
    id: "mock-discover-3",
    title: "Thyroid Smart Tofu Quinoa Stir Fry",
    description:
      "Balanced quinoa stir-fry with tofu and colorful vegetables for steady energy.",
    image:
      "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1200&q=80",
    cuisine: "Asian",
    prepTime: 14,
    cookTime: 16,
    difficulty: "Easy",
    servings: 2,
    tags: ["Thyroid-Friendly", "PCOS Friendly", "Vegan"],
    ingredients: [
      "150g firm tofu",
      "1 cup cooked quinoa",
      "1 cup bell peppers",
      "1/2 cup zucchini",
      "Ginger-garlic sesame sauce",
    ],
    instructions: [
      "Pan-sear tofu cubes until lightly crisp.",
      "Stir-fry vegetables for 3 to 4 minutes.",
      "Add quinoa, tofu, and sauce, then toss on high heat.",
      "Serve warm with toasted sesame seeds.",
    ],
    whoToAvoid: [
      "Anyone with soy allergy should replace tofu with chickpeas or paneer.",
    ],
    nutrition: [
      { name: "Calories", amount: 326 },
      { name: "Protein", amount: 21 },
      { name: "Carbohydrates", amount: 30 },
      { name: "Fat", amount: 13 },
      { name: "Fiber", amount: 8 },
    ],
  },
  {
    id: "mock-discover-4",
    title: "Cholesterol Smart Oats Veggie Upma",
    description:
      "Heart-friendly oats upma loaded with vegetables and fiber-rich seeds.",
    image:
      "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=80",
    cuisine: "Indian",
    prepTime: 10,
    cookTime: 18,
    difficulty: "Easy",
    servings: 2,
    tags: ["Cholesterol-Friendly", "High Fiber", "Vegetarian"],
    ingredients: [
      "1 cup rolled oats",
      "1/2 cup chopped carrots",
      "1/4 cup green peas",
      "1 tbsp flaxseed powder",
      "Mustard seeds, curry leaves, and lemon",
    ],
    instructions: [
      "Dry roast oats for 2 to 3 minutes and set aside.",
      "Saute mustard seeds, curry leaves, and vegetables.",
      "Add water, oats, and seasoning; cook until soft.",
      "Finish with flaxseed powder and lemon juice.",
    ],
    whoToAvoid: [
      "Those with oat sensitivity should substitute with millet or quinoa.",
    ],
    nutrition: [
      { name: "Calories", amount: 304 },
      { name: "Protein", amount: 11 },
      { name: "Carbohydrates", amount: 44 },
      { name: "Fat", amount: 9 },
      { name: "Fiber", amount: 10 },
    ],
  },
];

const filterMatchers = {
  diabetic: ["diabetic", "diabetes", "low sugar", "low-carb", "high-fiber"],
  anaemia: ["anaemia", "anemia", "iron", "iron-rich"],
  pcos: ["pcos", "pcod", "low-carb", "high-fiber"],
  cholesterol: ["cholesterol", "low-fat", "heart", "high-fiber"],
  thyroid: ["thyroid", "dairy-free", "gluten-free"],
  vegan: ["vegan", "plant-based"],
};

function buildRecipeText(recipe) {
  const searchableIngredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.map((ingredient) =>
        typeof ingredient === "string"
          ? ingredient
          : [ingredient.name, ingredient.unit].filter(Boolean).join(" "),
      )
    : [];

  const searchableInstructions = Array.isArray(recipe.instructions)
    ? recipe.instructions
    : [];

  const searchableLabels = [
    ...(Array.isArray(recipe.tags) ? recipe.tags : []),
    ...(Array.isArray(recipe.diets) ? recipe.diets : []),
    ...(Array.isArray(recipe.healthLabels) ? recipe.healthLabels : []),
    ...(Array.isArray(recipe.dishTypes) ? recipe.dishTypes : []),
    recipe.cuisine,
    recipe.difficulty,
  ];

  return [
    recipe.title,
    recipe.description,
    ...searchableLabels,
    ...searchableIngredients,
    ...searchableInstructions,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesFilter(recipe, activeFilter) {
  if (activeFilter === "all") {
    return true;
  }

  const normalizedTags = (Array.isArray(recipe.tags) ? recipe.tags : []).map(
    (tag) => tag.toLowerCase(),
  );
  const candidates = filterMatchers[activeFilter] || [activeFilter];

  return candidates.some((candidate) =>
    normalizedTags.some((tag) => tag.includes(candidate)),
  );
}

export default function DiscoverPage({ token }) {
  const [recipes, setRecipes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [savedRecipeIds, setSavedRecipeIds] = useState(new Set());
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const loadDiscoverRecipes = async () => {
      const cachedRecipes = clientCacheService.get(DISCOVER_CACHE_KEY);
      if (Array.isArray(cachedRecipes) && cachedRecipes.length > 0) {
        setRecipes(cachedRecipes);
        setIsLoading(false);
        return;
      }

      try {
        const response = await recipeService.getHealthyRecipes(token, {
          limit: 12,
        });

        if (!isActive) return;

        const nextRecipes = Array.isArray(response.data)
          ? response.data
          : DISCOVER_TEST_RECIPES;

        setRecipes(
          nextRecipes.length > 0 ? nextRecipes : DISCOVER_TEST_RECIPES,
        );
        clientCacheService.set(
          DISCOVER_CACHE_KEY,
          nextRecipes.length > 0 ? nextRecipes : DISCOVER_TEST_RECIPES,
          "SPOONACULAR_RECIPES",
        );
      } catch (error) {
        if (!isActive) return;
        console.error("Load discover recipes error:", error);
        setRecipes(DISCOVER_TEST_RECIPES);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    const loadSavedRecipes = async () => {
      if (!token) return;

      try {
        const savedRecipes = await recipeService.getSavedRecipes(token);
        if (!isActive) return;
        setSavedRecipeIds(
          new Set(
            savedRecipes
              .map((recipe) => recipeService.getRecipeIdentity(recipe))
              .filter(Boolean),
          ),
        );
      } catch (error) {
        if (!isActive) return;
        console.error("Saved recipes load error:", error);
      }
    };

    loadDiscoverRecipes();
    loadSavedRecipes();

    return () => {
      isActive = false;
    };
  }, [token]);

  const filteredRecipes = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return recipes.filter((recipe) => {
      const recipeText = buildRecipeText(recipe);
      const matchesSearch =
        !normalizedSearch || recipeText.includes(normalizedSearch);
      return matchesSearch && matchesFilter(recipe, activeFilter);
    });
  }, [recipes, searchTerm, activeFilter]);

  const syncSavedIds = async () => {
    if (!token) return;

    const savedRecipes = await recipeService.getSavedRecipes(token);
    setSavedRecipeIds(
      new Set(
        savedRecipes
          .map((recipe) => recipeService.getRecipeIdentity(recipe))
          .filter(Boolean),
      ),
    );
    clientCacheService.delete(SAVED_RECIPES_CACHE_KEY);
  };

  const handleSaveRecipe = async (recipe) => {
    if (!token || !recipe) return;

    try {
      await recipeService.saveRecipe(token, recipe);
      await syncSavedIds();
      setStatus({ type: "success", message: "Recipe saved to favorites!" });
    } catch (error) {
      setStatus({
        type: "error",
        message: error.message || "Error saving recipe.",
      });
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

  return (
    <div>
      <div className="discover-header">
        <div className="discover-header-content">
          <div className="discover-kicker">Curated Collection</div>
          <h1>All Healthy Recipes</h1>
          <p className="discover-subtitle">
            Recipes curated for specific health conditions
          </p>
        </div>
        <div className="discover-search-box">
          <input
            id="discoverSearch"
            type="search"
            placeholder="Search recipes or conditions..."
            className="discover-search-input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
      </div>

      <div className="filters-section-new">
        <div className="filter-pills-wrapper">
          {[
            ["all", "All Recipes", "✓"],
            ["diabetic", "Diabetic-Friendly", null],
            ["anaemia", "Iron-Rich (Anaemia)", null],
            ["pcos", "PCOD / PCOS", null],
            ["cholesterol", "Cholesterol-Friendly", null],
            ["thyroid", "Thyroid-Friendly", null],
            ["vegan", "Vegan", null],
          ].map(([value, label, icon]) => (
            <button
              key={value}
              className={`filter-pill ${activeFilter === value ? "active" : ""}`}
              type="button"
              data-filter={value}
              onClick={() => setActiveFilter(value)}
            >
              {icon ? <span className="filter-pill-icon">{icon}</span> : null}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {isLoading ? <Loader /> : null}

      <div className="recipes-grid-new" id="discoverRecipesContainer">
        {filteredRecipes.map((recipe) => {
          const recipeId = recipeService.getRecipeIdentity(recipe);
          return (
            <RecipeCard
              key={recipeId || recipe.title}
              recipe={recipe}
              isSaved={savedRecipeIds.has(recipeId)}
              onOpen={setSelectedRecipe}
              onSave={handleSaveRecipe}
            />
          );
        })}
      </div>

      <p className={`profile-status ${status.type}`} aria-live="polite">
        {status.message}
      </p>

      <RecipeModal
        recipe={selectedRecipe}
        isSaved={
          selectedRecipe
            ? savedRecipeIds.has(
                recipeService.getRecipeIdentity(selectedRecipe),
              )
            : false
        }
        onClose={() => setSelectedRecipe(null)}
        onSave={handleSaveRecipe}
        onWatchTutorial={handleWatchTutorial}
      />
    </div>
  );
}
