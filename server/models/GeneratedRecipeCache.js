const mongoose = require("mongoose");

/**
 * Generated Recipe Cache Model
 * Stores generated recipes based on user preferences
 * Allows quick retrieval without API call when same preferences used
 */
const GeneratedRecipeCacheSchema = new mongoose.Schema({
  preferencesHash: {
    type: String, // Hash of user preferences
    unique: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    sparse: true,
  },
  preferences: {
    dietaryPreferences: [String],
    allergies: [String],
    healthConditions: [String],
    deficiencies: [String],
    cuisinePreference: String,
    cookingTime: String,
    diet: [String],
    intolerances: [String],
    cuisine: String,
    maxReadyTime: Number,
  },
  recipes: [
    {
      spoonacularId: Number,
      title: String,
      image: String,
      prepTime: Number,
      cookTime: Number,
      servings: Number,
      ingredients: [
        {
          name: String,
          amount: Number,
          unit: String,
        },
      ],
      instructions: [String],
      nutrition: {
        calories: Number,
        carbs: Number,
        protein: Number,
        fat: Number,
      },
      vegan: Boolean,
      vegetarian: Boolean,
      diets: [String],
      cuisines: [String],
      dishTypes: [String],
      healthLabels: [String],
    },
  ],
  apiCallsUsed: {
    type: Number,
    default: 1,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 60 * 1000), // 30-minute cache
    index: { expireAfterSeconds: 0 },
  },
});

module.exports = mongoose.model(
  "GeneratedRecipeCache",
  GeneratedRecipeCacheSchema,
);
