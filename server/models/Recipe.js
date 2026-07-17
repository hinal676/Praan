const mongoose = require("mongoose");

/**
 * Recipe Model - Stores recipes fetched from Spoonacular
 * Used for initial seed (16 recipes) and browsing without API calls
 */
const RecipeSchema = new mongoose.Schema({
  spoonacularId: {
    type: Number,
    unique: true,
    sparse: true,
  },
  title: {
    type: String,
    required: true,
  },
  image: String,
  description: String,
  prepTime: Number,
  cookTime: Number,
  servings: Number,
  tags: [String],
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
    protein: Number,
    carbs: Number,
    fat: Number,
  },
  diets: [String],
  cuisines: [String],
  dishTypes: [String],
  healthLabels: [String],
  source: {
    type: String,
    default: "Spoonacular",
  },
  isSeeded: {
    type: Boolean,
    default: false,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for quick filtering by diet/health
RecipeSchema.index({ diets: 1, isSeeded: 1 });
RecipeSchema.index({ healthLabels: 1, isSeeded: 1 });
RecipeSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Recipe", RecipeSchema);
