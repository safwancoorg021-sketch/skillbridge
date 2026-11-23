
const mongoose = require("mongoose");

const emailOTPSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    otpHash: {
      type: String,
      required: true,
    },

    purpose: {
      type: String,
      enum: ["registration", "password-reset", "email-change"],
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: undefined,
    },

    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },

    attempts: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

emailOTPSchema.index({ email: 1, purpose: 1 });
emailOTPSchema.index({ userId: 1, purpose: 1, createdAt: -1 });

module.exports = mongoose.model("EmailOTP", emailOTPSchema);
