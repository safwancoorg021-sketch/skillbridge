const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    discountLabel: { type: String, required: true, trim: true, maxlength: 50 },
    couponCode: { type: String, trim: true, uppercase: true, default: "", maxlength: 32 },
    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

offerSchema.index({ isActive: 1, startsAt: 1, endsAt: 1 });

module.exports = mongoose.model("Offer", offerSchema);
