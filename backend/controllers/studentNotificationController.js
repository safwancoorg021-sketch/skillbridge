const mongoose = require("mongoose");
const StudentNotification = require("../models/StudentNotification");
const Offer = require("../models/Offer");
const Coupon = require("../models/Coupon");
const SupportTicket = require("../models/SupportTicket");
const { notifyStudent } = require("../utils/studentNotifications");

const sendError = (res, message, status = 500) => res.status(status).json({ success: false, message });
const serialize = ({ _id, ...notification }) => ({ ...notification, id: String(_id) });

exports.listMine = async (req, res) => {
  try {
    const now = new Date();
    const offers = await Offer.find({ isActive: true, startsAt: { $lte: now }, endsAt: { $gte: now } }).select("title discountLabel couponCode").lean();
    const codes = offers.map((offer) => offer.couponCode).filter(Boolean);
    const validCoupons = codes.length ? await Coupon.find({ code: { $in: codes }, isActive: true, startsAt: { $lte: now }, endsAt: { $gte: now } }).select("code").lean() : [];
    const validCodes = new Set(validCoupons.map((coupon) => coupon.code));
    await Promise.all(offers.filter((offer) => !offer.couponCode || validCodes.has(offer.couponCode)).map((offer) => notifyStudent(req.user.id, {
      type: "offer",
      title: "Student offer available",
      message: `${offer.discountLabel}: ${offer.title}${offer.couponCode ? ` · Code ${offer.couponCode}` : ""}`,
      linkPath: "/offers",
      sourceKey: `offer:${offer._id}`,
    })));
    const repliedTickets = await SupportTicket.find({ student: req.user.id, adminReply: { $ne: "" }, adminRespondedAt: { $ne: null } })
      .select("subject adminReply adminRespondedAt")
      .lean();
    await Promise.all(repliedTickets.map((ticket) => notifyStudent(req.user.id, {
      type: "system",
      title: "Support replied",
      message: `${ticket.subject}: ${ticket.adminReply.slice(0, 180)}`,
      linkPath: "/help",
      sourceKey: `support-reply:${ticket._id}:${new Date(ticket.adminRespondedAt).getTime()}`,
    })));
    const [notifications, unreadCount] = await Promise.all([
      StudentNotification.find({ student: req.user.id, readAt: null }).sort({ createdAt: -1, _id: -1 }).limit(50).lean(),
      StudentNotification.countDocuments({ student: req.user.id, readAt: null }),
    ]);
    return res.json({ success: true, notifications: notifications.map(serialize), unreadCount });
  } catch (error) {
    console.error("Student notification list error:", error.message);
    return sendError(res, "Unable to load your notifications.");
  }
};

exports.markAllRead = async (req, res) => {
  try {
    const result = await StudentNotification.updateMany(
      { student: req.user.id, readAt: null },
      { $set: { readAt: new Date() } }
    );
    return res.json({ success: true, updated: result.modifiedCount || 0 });
  } catch (error) {
    console.error("Mark all notifications read error:", error.message);
    return sendError(res, "Unable to update notifications.");
  }
};

exports.markRead = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return sendError(res, "Invalid notification ID.", 400);
  try {
    const notification = await StudentNotification.findOneAndUpdate(
      { _id: req.params.id, student: req.user.id, readAt: null },
      { $set: { readAt: new Date() } },
      { new: true }
    ).lean();
    if (!notification) {
      const exists = await StudentNotification.exists({ _id: req.params.id, student: req.user.id });
      if (!exists) return sendError(res, "Notification not found.", 404);
    }
    return res.json({ success: true, notification: notification ? serialize(notification) : null });
  } catch (error) {
    console.error("Mark notification read error:", error.message);
    return sendError(res, "Unable to update this notification.");
  }
};
