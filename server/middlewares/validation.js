const { body, validationResult } = require("express-validator");

// Custom validation middleware to check results
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }
  next();
};

// Auth validation rules
exports.validateSignup = [
  body("name", "Name is required and must be valid")
    .trim()
    .isLength({ min: 2, max: 50 }),
  body("email", "Please provide a valid email").isEmail().normalizeEmail(),
  body("password", "Password must be at least 6 characters").isLength({
    min: 6,
  }),
];

exports.validateLogin = [
  body("email", "Please provide a valid email").isEmail().normalizeEmail(),
  body("password", "Password is required").not().isEmpty(),
];

// Recipe generation validation
exports.validateRecipeGeneration = [
  body("dietaryPreferences").isArray().optional(),
  body("healthConditions").isArray().optional(),
  body("allergies").isArray().optional(),
  body("basicDetails").isObject().optional(),
  body("basicDetails.age").isInt({ min: 1, max: 150 }).optional(),
  body("basicDetails.weight").isInt({ min: 1 }).optional(),
  body("basicDetails.height").isInt({ min: 1 }).optional(),
  body("cuisinePreference").isString().trim().optional(),
  body("cookingTime").isString().trim().optional(),
];

// User profile update validation
exports.validateUserUpdate = [
  body("name", "Name must be valid")
    .trim()
    .isLength({ min: 2, max: 50 })
    .optional(),
  body("healthConditions").isArray().optional(),
  body("preferences").isObject().optional(),
];
