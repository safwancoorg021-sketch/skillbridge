const express = require("express");
const mongoose = require("mongoose");

const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(authMiddleware, requireRole("admin"));

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const USER_FIELDS =
  "name email role profileImage isEmailVerified isBlocked createdAt";

const parsePositiveInteger = (value, fallback) => {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const escapeRegex = (value) =>
  value.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/[{}]/g, "\\$&");

const serializeUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  profileImage: user.profileImage || "",
  isEmailVerified: user.isEmailVerified,
  isBlocked: user.isBlocked,
  createdAt: user.createdAt,
});

router.get("/summary", async (req, res) => {
  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const studentFilter = { role: "student" };
    const [
      totalStudents,
      verifiedStudents,
      blockedStudents,
      newStudentsThisMonth,
      recentStudents,
    ] = await Promise.all([
      User.countDocuments(studentFilter),
      User.countDocuments({ ...studentFilter, isEmailVerified: true }),
      User.countDocuments({ ...studentFilter, isBlocked: true }),
      User.countDocuments({
        ...studentFilter,
        createdAt: { $gte: monthStart },
      }),
      User.find(studentFilter)
        .select(USER_FIELDS)
        .sort({ createdAt: -1, _id: -1 })
        .limit(6)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      summary: {
        totalStudents,
        verifiedStudents,
        blockedStudents,
        newStudentsThisMonth,
      },
      recentStudents: recentStudents.map(serializeUser),
    });
  } catch (error) {
    console.error("Admin dashboard summary error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve the admin dashboard right now.",
    });
  }
});
// GET /api/admin/users?page=1&limit=10&search=name-or-email
// Omitting search (including after the frontend clears it) returns all students.
router.get("/", async (req, res) => {
  try {
    const page = parsePositiveInteger(req.query.page, 1);
    const requestedLimit = parsePositiveInteger(req.query.limit, DEFAULT_LIMIT);

    if (page === null || requestedLimit === null) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be positive whole numbers.",
      });
    }

    const rawSearch = req.query.search;
    if (rawSearch !== undefined && typeof rawSearch !== "string") {
      return res.status(400).json({
        success: false,
        message: "Search must be a single text value.",
      });
    }

    const search = rawSearch ? rawSearch.trim() : "";
    if (search.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Search cannot exceed 100 characters.",
      });
    }

    const filter = { role: "student" };
    if (search) {
      const expression = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: expression }, { email: expression }];
    }

    const limit = Math.min(requestedLimit, MAX_LIMIT);
    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / limit);
    const users =
      page > totalPages
        ? []
        : await User.find(filter)
            .select(USER_FIELDS)
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

    return res.status(200).json({
      success: true,
      users: users.map(serializeUser),
      pagination: {
        page,
        limit,
        totalUsers,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Admin user listing error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve users right now.",
    });
  }
});

const updateBlockStatus = (isBlocked) => async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "A valid user ID is required.",
      });
    }

    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        role: "student",
        isBlocked: { $ne: isBlocked },
      },
      {
        $set: { isBlocked },
        $inc: { tokenVersion: 1 },
      },
      { new: true, runValidators: true }
    ).select(USER_FIELDS);

    if (user) {
      return res.status(200).json({
        success: true,
        message: isBlocked ? "User blocked." : "User unblocked.",
        user: serializeUser(user),
      });
    }

    const existingUser = await User.findOne({
      _id: userId,
      role: "student",
    }).select(USER_FIELDS);

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: isBlocked ? "User is already blocked." : "User is already unblocked.",
      user: serializeUser(existingUser),
    });
  } catch (error) {
    console.error("Admin user status update error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to update this user's status right now.",
    });
  }
};

// Confirmation prompts are a frontend responsibility.
router.patch("/:userId/block", updateBlockStatus(true));
router.patch("/:userId/unblock", updateBlockStatus(false));

module.exports = router;

