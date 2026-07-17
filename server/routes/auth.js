const express = require("express");
const {
  register,
  login,
  getMe,
  logout,
} = require("../controllers/authController");
const { protect } = require("../middlewares/auth");
const {
  validateSignup,
  validateLogin,
  validate,
} = require("../middlewares/validation");
const { authLimiter } = require("../middlewares/rateLimit");

const router = express.Router();

router.post("/register", authLimiter, validateSignup, validate, register);
router.post("/login", authLimiter, validateLogin, validate, login);
router.get("/me", protect, getMe);
router.get("/logout", protect, logout);

module.exports = router;
