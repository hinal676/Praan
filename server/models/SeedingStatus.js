const mongoose = require("mongoose");

/**
 * Seeding Status Model
 * Tracks whether initial 10 recipes have been fetched from Spoonacular
 * Prevents re-seeding and repeated API calls
 */
const SeedingStatusSchema = new mongoose.Schema({
  name: {
    type: String,
    default: "spoonacular",
    unique: true,
  },
  isSeeded: {
    type: Boolean,
    default: false,
  },
  totalRecipes: {
    type: Number,
    default: 0,
  },
  seededAt: Date,
  nextAllowedReseed: Date,
});

module.exports = mongoose.model("SeedingStatus", SeedingStatusSchema);
