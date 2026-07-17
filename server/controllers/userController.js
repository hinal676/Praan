const User = require("../models/User");

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching profile",
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateUserProfile = async (req, res) => {
  try {
    const { name, healthConditions, preferences, basicDetails } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.preferences = user.preferences || {};
    user.basicDetails = user.basicDetails || {};

    if (name) {
      user.name = name.trim();
    }

    if (Array.isArray(healthConditions)) {
      user.healthConditions = healthConditions;
    }

    if (preferences && typeof preferences === "object") {
      if (Array.isArray(preferences.diet)) {
        user.preferences.diet = preferences.diet;
      }

      if (Array.isArray(preferences.allergies)) {
        user.preferences.allergies = preferences.allergies;
      }

      if (typeof preferences.cuisine === "string" && preferences.cuisine) {
        user.preferences.cuisine = preferences.cuisine;
      }

      if (Array.isArray(preferences.deficiencies)) {
        user.preferences.deficiencies = preferences.deficiencies;
      }
    }

    if (basicDetails && typeof basicDetails === "object") {
      if (basicDetails.age !== undefined && basicDetails.age !== null) {
        user.basicDetails.age = basicDetails.age;
      }

      if (basicDetails.gender) {
        user.basicDetails.gender = basicDetails.gender;
      }

      if (basicDetails.weight !== undefined && basicDetails.weight !== null) {
        user.basicDetails.weight = basicDetails.weight;
      }

      if (basicDetails.height !== undefined && basicDetails.height !== null) {
        user.basicDetails.height = basicDetails.height;
      }

      if (
        typeof basicDetails.cookingTime === "string" &&
        basicDetails.cookingTime
      ) {
        user.basicDetails.cookingTime = basicDetails.cookingTime;
      }
    }

    await user.save();

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Update profile error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error updating profile",
    });
  }
};

// @desc    Update health preferences
// @route   PUT /api/users/preferences
// @access  Private
exports.updatePreferences = async (req, res) => {
  try {
    const {
      healthConditions,
      diet,
      allergies,
      cuisine,
      deficiencies,
      basicDetails,
      cookingTime,
    } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        ...(healthConditions && { healthConditions }),
        preferences: {
          ...(diet && { diet }),
          ...(allergies && { allergies }),
          ...(cuisine && { cuisine }),
          ...(deficiencies && { deficiencies }),
        },
        ...(basicDetails && { basicDetails }),
        ...(cookingTime && { "basicDetails.cookingTime": cookingTime }),
      },
      { new: true, runValidators: true },
    );

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Update preferences error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating preferences",
    });
  }
};

// @desc    Delete user account
// @route   DELETE /api/users/profile
// @access  Private
exports.deleteProfile = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user.id);

    res.status(200).json({
      success: true,
      message: "Profile deleted successfully",
    });
  } catch (error) {
    console.error("Delete profile error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting profile",
    });
  }
};
