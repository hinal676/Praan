/**
 * One-off backfill for recipes that were seeded without instructions
 * (e.g. because a past Spoonacular detail call failed or hit a 402 quota
 * error during seeding). Unlike /api/recipes/reseed, this does NOT delete
 * or re-fetch the whole catalog - it only touches recipes that still have
 * an empty `instructions` array, and is safe to re-run.
 *
 * Usage: node server/scripts/backfillRecipeInstructions.js
 */
require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});
const mongoose = require("mongoose");
const axios = require("axios");
const Recipe = require("../models/Recipe");
const optimizedRecipeService = require("../services/optimizedRecipeService");

const SPOONACULAR_BASE_URL = "https://api.spoonacular.com/recipes";
const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const recipesNeedingInstructions = await Recipe.find({
    isSeeded: true,
    $or: [
      { instructions: { $exists: false } },
      { instructions: { $size: 0 } },
    ],
  });

  console.log(
    `Found ${recipesNeedingInstructions.length} recipe(s) missing instructions.`,
  );

  let fixed = 0;
  let stillMissing = 0;
  let failed = 0;

  for (const recipe of recipesNeedingInstructions) {
    try {
      const response = await axios.get(
        `${SPOONACULAR_BASE_URL}/${recipe.spoonacularId}/information`,
        {
          params: { apiKey: SPOONACULAR_API_KEY, includeNutrition: true },
          timeout: 10000,
        },
      );

      const instructions = optimizedRecipeService._extractInstructions(
        response.data,
      );

      if (instructions.length > 0) {
        recipe.instructions = instructions;
        await recipe.save();
        fixed += 1;
        console.log(`Fixed "${recipe.title}" (${instructions.length} steps)`);
      } else {
        stillMissing += 1;
        console.warn(
          `"${recipe.title}" still has no instructions after refetch.`,
        );
      }
    } catch (error) {
      failed += 1;
      const statusCode = error.response?.status;

      if (statusCode === 402) {
        console.error(
          `Quota exceeded (402) while fetching "${recipe.title}". Stopping early - re-run this script later to pick up where it left off.`,
        );
        break;
      }

      console.error(`Failed to fetch "${recipe.title}": ${error.message}`);
    }
  }

  console.log(
    `\nDone. Fixed: ${fixed}, still missing: ${stillMissing}, failed: ${failed}.`,
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
