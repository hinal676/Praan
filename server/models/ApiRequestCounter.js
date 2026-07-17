const mongoose = require("mongoose");

/**
 * API Request Counter Model
 * Tracks daily API calls for recipe generation
 * Enforces strict limit: max 5 calls per day
 */
const ApiRequestCounterSchema = new mongoose.Schema({
  date: {
    type: String, // Format: YYYY-MM-DD
    unique: true,
    index: true,
  },
  generationCalls: {
    type: Number,
    default: 0,
  },
  youtubeSearches: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expire: 86400, // Auto-delete after 24 hours
  },
});

module.exports = mongoose.model("ApiRequestCounter", ApiRequestCounterSchema);
