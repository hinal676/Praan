const express = require("express");
const {
  getUserProfile,
  updateUserProfile,
  updatePreferences,
  deleteProfile,
} = require("../controllers/userController");
const { protect } = require("../middlewares/auth");
const { validateUserUpdate, validate } = require("../middlewares/validation");

const router = express.Router();

router.get("/profile", protect, getUserProfile);
router.put(
  "/profile",
  protect,
  validateUserUpdate,
  validate,
  updateUserProfile,
);
router.put("/preferences", protect, updatePreferences);
router.delete("/profile", protect, deleteProfile);

module.exports = router;
