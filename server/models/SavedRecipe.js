const mongoose = require("mongoose");

const SavedRecipeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "User ID is required"],
  },
  recipeId: {
    type: String,
    required: [true, "Recipe ID is required"],
  },
  title: {
    type: String,
    required: [true, "Recipe title is required"],
  },
  image: {
    type: String,
    required: false,
  },
  tags: {
    type: [String],
    default: [],
  },
  description: {
    type: String,
    default: "",
  },
  prepTime: {
    type: Number,
    default: 0,
  },
  cookTime: {
    type: Number,
    default: 0,
  },
  servings: {
    type: Number,
    default: 0,
  },
  ingredients: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  instructions: {
    type: [String],
    default: [],
  },
  healthBenefits: {
    suitableFor: {
      type: [String],
      enum: ["diabetes", "cholesterol", "pcos", "anaemia", "thyroid"],
      default: [],
    },
    avoidFor: {
      type: [String],
      enum: ["diabetes", "cholesterol", "pcos", "anaemia", "thyroid"],
      default: [],
    },
  },
  nutrition: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number,
  },
  savedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Compound index for quick user lookups
SavedRecipeSchema.index({ userId: 1, savedAt: -1 });

module.exports = mongoose.model("SavedRecipe", SavedRecipeSchema);
