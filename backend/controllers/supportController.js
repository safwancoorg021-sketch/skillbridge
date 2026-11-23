const mongoose = require("mongoose");
const SupportTicket = require("../models/SupportTicket");
const { notifyStudent } = require("../utils/studentNotifications");

const STATUSES = ["open", "in_progress", "resolved"];
const CATEGORIES = ["account", "course", "payment", "technical", "other"];
const sendError = (res, message, status = 500) => res.status(status).json({ success: false, message });

exports.listMine = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ student: req.user.id }).sort({ updatedAt: -1, _id: -1 }).limit(100).lean();
    return res.json({ success: true, tickets });
  } catch (error) {
    console.error("Student support ticket list error:", error.message);
    return sendError(res, "Unable to load your support requests.");
  }
};

exports.create = async (req, res) => {
  const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const category = typeof req.body?.category === "string" ? req.body.category : "other";
  if (subject.length < 3 || subject.length > 120) return sendError(res, "Subject must be 3–120 characters.", 400);
  if (message.length < 10 || message.length > 2000) return sendError(res, "Describe the issue in 10–2000 characters.", 400);
  if (!CATEGORIES.includes(category)) return sendError(res, "Choose a valid support category.", 400);
  try {
    const ticket = await SupportTicket.create({ student: req.user.id, subject, category, message });
    return res.status(201).json({ success: true, message: "Your support request was sent.", ticket });
  } catch (error) {
    console.error("Student support ticket create error:", error.message);
    return sendError(res, "Unable to send your support request.");
  }
};

exports.listAll = async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : "all";
  if (status !== "all" && !STATUSES.includes(status)) return sendError(res, "Choose a valid status filter.", 400);
  try {
    const filter = status === "all" ? {} : { status };
    const tickets = await SupportTicket.find(filter)
      .populate("student", "name email")
      .sort({ createdAt: -1, _id: -1 })
      .limit(250)
      .lean();
    return res.json({ success: true, tickets });
  } catch (error) {
    console.error("Admin support ticket list error:", error.message);
    return sendError(res, "Unable to load support requests.");
  }
};

exports.update = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendError(res, "Invalid support request ID.", 400);
  const fields = {};
  if (req.body?.status !== undefined) {
    if (!STATUSES.includes(req.body.status)) return sendError(res, "Choose a valid support status.", 400);
    fields.status = req.body.status;
  }
  if (req.body?.adminReply !== undefined) {
    if (typeof req.body.adminReply !== "string" || req.body.adminReply.trim().length > 2000) return sendError(res, "Reply must be no more than 2000 characters.", 400);
    fields.adminReply = req.body.adminReply.trim();
    fields.adminRespondedAt = fields.adminReply ? new Date() : null;
  }
  if (!Object.keys(fields).length) return sendError(res, "Provide a status or reply to save.", 400);
  try {
    const previous = await SupportTicket.findById(req.params.id).select("student adminReply").lean();
    if (!previous) return sendError(res, "Support request not found.", 404);
    const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, { $set: fields }, { new: true, runValidators: true })
      .populate("student", "name email")
      .lean();
    if (!ticket) return sendError(res, "Support request not found.", 404);
    if (fields.adminReply && fields.adminReply !== (previous.adminReply || "")) {
      await notifyStudent(previous.student, {
        type: "system",
        title: "Support replied",
        message: `${ticket.subject}: ${ticket.adminReply.slice(0, 180)}`,
        linkPath: "/help",
        sourceKey: `support-reply:${ticket._id}:${ticket.adminRespondedAt.getTime()}`,
      });
    }
    return res.json({ success: true, message: "Support request updated.", ticket });
  } catch (error) {
    console.error("Admin support ticket update error:", error.message);
    return sendError(res, "Unable to update this support request.");
  }
};
