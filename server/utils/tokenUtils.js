const jwt = require("jsonwebtoken");

// Generate JWT token
exports.generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

// Send token response with cookie
exports.sendTokenResponse = (user, statusCode, res) => {
  const token = exports.generateToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  res
    .status(statusCode)
    .cookie("token", token, cookieOptions)
    .json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        healthConditions: user.healthConditions,
        preferences: user.preferences,
        basicDetails: user.basicDetails,
      },
    });
};
