const mongoose = require("mongoose");

const studentNotificationSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["offer", "enrollment", "progress", "system"], default: "system" },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    message: { type: String, required: true, trim: true, maxlength: 400 },
    linkPath: { type: String, default: "", maxlength: 200 },
    sourceKey: { type: String, trim: true, maxlength: 200, default: undefined },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

studentNotificationSchema.index({ student: 1, createdAt: -1 });
studentNotificationSchema.index({ student: 1, sourceKey: 1 }, { unique: true, partialFilterExpression: { sourceKey: { $exists: true } } });

module.exports = mongoose.model("StudentNotification", studentNotificationSchema);
