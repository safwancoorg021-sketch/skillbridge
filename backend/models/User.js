

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      select: false,
      required: function () {
        return this.authProvider === "local";
      },
      minlength: 8,
    },

    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    googleId: {
      type: String,
      sparse: true,
    },

    role: {
      type: String,
      enum: ["student", "admin"],
      default: "student",
      required: true,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

    tokenVersion: {
      type: Number,
      default: 0,
    },

    passwordResetTokenHash: {
      type: String,
      default: undefined,
      select: false,
    },

    passwordResetTokenExpiresAt: {
      type: Date,
      default: undefined,
      select: false,
    },

    profileImage: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
