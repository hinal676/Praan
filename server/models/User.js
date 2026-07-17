const mongoose = require("mongoose");
const bcryptjs = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please provide a name"],
    trim: true,
    maxlength: [50, "Name cannot be more than 50 characters"],
  },
  email: {
    type: String,
    required: [true, "Please provide an email"],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      "Please provide a valid email",
    ],
  },
  password: {
    type: String,
    required: [true, "Please provide a password"],
    minlength: [6, "Password must be at least 6 characters"],
    select: false,
  },
  healthConditions: {
    type: [String],
    enum: ["diabetes", "cholesterol", "pcos", "anaemia", "thyroid", "none"],
    default: ["none"],
  },
  preferences: {
    diet: {
      type: [String],
      enum: ["veg", "non-veg", "vegan", "gluten-free", "dairy-free"],
      default: [],
    },
    allergies: {
      type: [String],
      enum: ["nuts", "dairy", "gluten", "shellfish", "soy", "sesame"],
      default: [],
    },
    cuisine: {
      type: String,
      enum: [
        "indian",
        "italian",
        "chinese",
        "mexican",
        "mediterranean",
        "thai",
        "other",
      ],
      default: "indian",
    },
    deficiencies: {
      type: [String],
      enum: ["iron", "calcium", "vitamin-d", "protein", "b12", "none"],
      default: ["none"],
    },
  },
  basicDetails: {
    age: {
      type: Number,
      min: [1, "Age must be a positive number"],
      max: [150, "Please provide a valid age"],
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    weight: {
      type: Number,
      min: [1, "Weight must be positive"],
    },
    height: {
      type: Number,
      min: [1, "Height must be positive"],
    },
    cookingTime: {
      type: String,
      enum: ["<15min", "15-30min", "30-45min", ">45min"],
      default: "15-30min",
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
UserSchema.pre("save", async function (next) {
  // Only hash if password is modified
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcryptjs.genSalt(10);
    this.password = await bcryptjs.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to compare passwords
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcryptjs.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", UserSchema);
