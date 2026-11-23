const mongoose = require("mongoose");

const paymentOrderSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: [
      {
        _id: false,
        course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
        title: { type: String, required: true },
        amountPaise: { type: Number, required: true, min: 0 },
      },
    ],
    amountPaise: { type: Number, required: true, min: 0 },
    subtotalPaise: { type: Number, default: 0, min: 0 },
    discountPaise: { type: Number, default: 0, min: 0 },
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", default: null },
    couponCode: { type: String, default: "" },
    currency: { type: String, default: "INR", enum: ["INR"] },
    provider: { type: String, default: "razorpay", enum: ["razorpay", "free"] },
    providerOrderId: { type: String, unique: true, sparse: true },
    paymentId: { type: String, default: "" },
    status: { type: String, enum: ["pending", "paid", "failed"], default: "pending", index: true },
    paidAt: { type: Date, default: null },
    refundRequestStatus: { type: String, enum: ["none", "requested", "approved", "rejected"], default: "none" },
    refundRequestedAt: { type: Date, default: null },
    refundReason: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PaymentOrder", paymentOrderSchema);
