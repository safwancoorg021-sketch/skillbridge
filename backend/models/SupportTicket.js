const mongoose = require("mongoose");

const supportTicketSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subject: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    category: { type: String, enum: ["account", "course", "payment", "technical", "other"], default: "other" },
    message: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    status: { type: String, enum: ["open", "in_progress", "resolved"], default: "open", index: true },
    adminReply: { type: String, trim: true, maxlength: 2000, default: "" },
    adminRespondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

supportTicketSchema.index({ createdAt: -1 });

module.exports = mongoose.model("SupportTicket", supportTicketSchema);
