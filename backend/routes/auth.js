
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const User = require("../models/User");
const EmailOTP = require("../models/EmailOTP");
const transporter = require("../config/mailer");
const authMiddleware = require("../middleware/authMiddleware");
const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

const router = express.Router();
const signInLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many sign-in attempts. Please try again in 15 minutes.",
  },
});
const PROFILE_NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ .'-][\p{L}\p{M}]+)*$/u;
const OTP_EXPIRY_MS = 3 * 60 * 1000;
const OTP_RESEND_SECONDS = 3 * 60;
const OTP_RESEND_MS = OTP_RESEND_SECONDS * 1000;
const profileImageDirectory = path.join(__dirname, "..", "uploads", "profile-images");
const profileImageUrlPrefix = "/uploads/profile-images/";

async function removeStoredProfileImage(imageUrl) {
  if (typeof imageUrl !== "string" || !imageUrl.startsWith(profileImageUrlPrefix)) return;
  const filename = imageUrl.slice(profileImageUrlPrefix.length);
  if (!/^[a-f0-9-]{36}\.jpg$/i.test(filename)) return;

  try {
    await fs.unlink(path.join(profileImageDirectory, filename));
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Unable to remove old profile image:", error.message);
    }
  }
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const {
    fullname,
    email,
    password,
    "confirm-password": confirmPassword,
    termsAccepted,
} = req.body;

    if (
      typeof fullname !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof confirmPassword !== "string" ||
      !fullname.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required.",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    if (termsAccepted !== true) {
      return res.status(400).json({
        success: false,
        message: "You must accept the terms and conditions.",
      });
    }

    const cleanName = fullname.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 2 || cleanName.length > 80) {
      return res.status(400).json({
        success: false,
        message: "Name must be between 2 and 80 characters.",
      });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 128 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must contain at least 8 characters, including uppercase, lowercase, number and special character.",
      });
    }

    let user = await User.findOne({ email: cleanEmail });

    if (user && user.isEmailVerified) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const recentOTP = await EmailOTP.findOne({
      email: cleanEmail,
      purpose: "registration",
    });
    if (recentOTP && Date.now() - recentOTP.createdAt.getTime() < OTP_RESEND_MS) {
      const retryAfterSeconds = Math.max(
        1,
        OTP_RESEND_SECONDS - Math.floor((Date.now() - recentOTP.createdAt.getTime()) / 1000)
      );
      return res.status(429).json({
        success: false,
        message: `Please wait ${retryAfterSeconds} seconds before requesting another OTP.`,
        retryAfterSeconds,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    if (!user) {
      user = new User({
        name: cleanName,
        email: cleanEmail,
        password: hashedPassword,
        role: "student",
        authProvider: "local",
        isEmailVerified: false,
      });
    } else {
      user.name = cleanName;
      user.password = hashedPassword;
    }

    await user.save();

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await EmailOTP.findOneAndDelete({
      email: cleanEmail,
      purpose: "registration",
    });

    await EmailOTP.create({
    email: cleanEmail,
    otpHash,
    purpose: "registration",
    expiresAt,
    attempts: 0,
  });

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: cleanEmail,
        subject: "Your SkillBridge verification code",
        text: `Your SkillBridge OTP is ${otp}. It expires in 3 minutes. Do not share this code with anyone.`,
      });
    } catch (emailError) {
      await EmailOTP.deleteOne({
        email: cleanEmail,
        purpose: "registration",
      });

      if (!user.isEmailVerified) {
        await User.deleteOne({
          _id: user._id,
          isEmailVerified: false,
        });
      }

      throw emailError;
    }

    return res.status(200).json({
      success: true,
      message: "OTP sent to your email. It expires in 3 minutes.",
      resendAfterSeconds: OTP_RESEND_SECONDS,
      expiresInSeconds: OTP_RESEND_SECONDS,
    });
  } catch (error) {
    console.error("Registration error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to process registration right now.",
    });
  }
});

// POST /api/auth/verify-email
router.post("/verify-email", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (
      typeof email !== "string" ||
      typeof otp !== "string" ||
      !/^\d{6}$/.test(otp)
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email and 6-digit OTP.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const otpRecord = await EmailOTP.findOne({
      email: cleanEmail,
      purpose: "registration",
    });

    if (!otpRecord || otpRecord.expiresAt <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP is invalid or expired. Please register again.",
      });
    }

    if (otpRecord.attempts >= 5) {
      await EmailOTP.deleteOne({ _id: otpRecord._id });

      return res.status(429).json({
        success: false,
        message: "Too many attempts. Please request a new OTP.",
      });
    }

    const isMatch = await bcrypt.compare(otp, otpRecord.otpHash);

    if (!isMatch) {
      otpRecord.attempts += 1;
      await otpRecord.save();

      return res.status(400).json({
        success: false,
        message: "Incorrect OTP.",
      });
    }

    const user = await User.findOne({
      email: cleanEmail,
      isEmailVerified: false,
      authProvider: "local",
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Registration could not be verified. Please register again.",
      });
    }

    user.isEmailVerified = true;
    await user.save();

    await EmailOTP.deleteOne({ _id: otpRecord._id });

    return res.status(200).json({
      success: true,
      message: "Email verified. Your Student account is now registered.",
    });
  } catch (error) {
    console.error("Email verification error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to verify email right now.",
    });
  }
});

async function loginWithRole(req, res, requiredRole) {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: cleanEmail }).select("+password");

    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect || user.role !== requiredRole) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in.",
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account is blocked. Please contact the administrator.",
      });
    }

    const jwt = require("jsonwebtoken");

    const token = jwt.sign(
  {
    userId: user._id.toString(),
    role: user.role,
    tokenVersion: user.tokenVersion || 0,
  },
  process.env.JWT_SECRET,
  { expiresIn: "1d" }
);

    console.log("Login successful.");

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        authProvider: user.authProvider,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to log in right now.",
    });
  }
}

// Keep student and administrator sign-in role-specific on the server.
router.post("/login", signInLimiter, (req, res) => loginWithRole(req, res, "student"));
router.post("/admin/login", signInLimiter, (req, res) => loginWithRole(req, res, "admin"));


router.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Unable to resend OTP. Please check your registration details.",
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "This email is already verified. Please log in.",
      });
    }

    if (user.authProvider !== "local") {
      return res.status(400).json({
        success: false,
        message: "This account does not use email OTP verification.",
      });
    }

    const recentOTP = await EmailOTP.findOne({
      email: cleanEmail,
      purpose: "registration",
    });

    // Prevent repeatedly requesting new OTPs.
    if (
      recentOTP &&
      Date.now() - recentOTP.createdAt.getTime() < OTP_RESEND_MS
    ) {
      const retryAfterSeconds = Math.max(
        1,
        OTP_RESEND_SECONDS - Math.floor((Date.now() - recentOTP.createdAt.getTime()) / 1000)
      );
      return res.status(429).json({
        success: false,
        message: `Please wait ${retryAfterSeconds} seconds before requesting another OTP.`,
        retryAfterSeconds,
      });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();

    const otpHash = await bcrypt.hash(otp, 10);

    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await EmailOTP.deleteMany({
      email: cleanEmail,
      purpose: "registration",
    });

    await EmailOTP.create({
      email: cleanEmail,
      otpHash,
      purpose: "registration",
      expiresAt,
    });

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: cleanEmail,
        subject: "Your SkillBridge verification OTP",
        text: `Your SkillBridge verification OTP is ${otp}. It expires in 3 minutes.`,
      });
    } catch (emailError) {
      await EmailOTP.deleteMany({
        email: cleanEmail,
        purpose: "registration",
      });

      console.error("Resend OTP email failed:", emailError.message);

      return res.status(500).json({
        success: false,
        message: "Unable to send OTP email. Please try again later.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "A new OTP has been sent to your email. It expires in 3 minutes.",
      resendAfterSeconds: OTP_RESEND_SECONDS,
      expiresInSeconds: OTP_RESEND_SECONDS,
    });

  } catch (error) {
    console.error("Resend OTP error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while resending OTP.",
    });
  }
});


router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: cleanEmail, isEmailVerified: true });

    // Use a generic response to avoid revealing which emails are registered.
    const genericMessage =
      "If an eligible account exists, a password-reset OTP will be sent.";

    if (!user) {
      return res.status(200).json({
        success: true,
        message: genericMessage,
        resendAfterSeconds: OTP_RESEND_SECONDS,
        expiresInSeconds: OTP_RESEND_SECONDS,
      });
    }

    const recentOTP = await EmailOTP.findOne({
      email: cleanEmail,
      purpose: "password-reset",
    });

    if (
      recentOTP &&
      Date.now() - recentOTP.createdAt.getTime() < OTP_RESEND_MS
    ) {
      const retryAfterSeconds = Math.max(
        1,
        OTP_RESEND_SECONDS - Math.floor((Date.now() - recentOTP.createdAt.getTime()) / 1000)
      );
      return res.status(429).json({
        success: false,
        message: `Please wait ${retryAfterSeconds} seconds before requesting another OTP.`,
        retryAfterSeconds,
      });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await EmailOTP.deleteMany({
      email: cleanEmail,
      purpose: "password-reset",
    });

    await EmailOTP.create({
      email: cleanEmail,
      otpHash,
      purpose: "password-reset",
      expiresAt,
      attempts: 0,
    });

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: cleanEmail,
        subject: "SkillBridge password reset OTP",
        text: `Your SkillBridge password-reset OTP is ${otp}. It expires in 3 minutes. Do not share this code with anyone.`,
      });
    } catch (emailError) {
      await EmailOTP.deleteMany({
        email: cleanEmail,
        purpose: "password-reset",
      });

      console.error("Password-reset email failed:", emailError.message);

      return res.status(500).json({
        success: false,
        message: "Unable to send the password-reset email. Please try again later.",
      });
    }

    return res.status(200).json({
      success: true,
      message: genericMessage,
      resendAfterSeconds: OTP_RESEND_SECONDS,
      expiresInSeconds: OTP_RESEND_SECONDS,
    });
  } catch (error) {
    console.error("Forgot password error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to process your request right now.",
    });
  }
});


router.post("/verify-reset-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (
      typeof email !== "string" ||
      typeof otp !== "string" ||
      !/^\d{6}$/.test(otp)
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email and 6-digit OTP.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: cleanEmail, isEmailVerified: true });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP. Please request a new one.",
      });
    }

    const otpRecord = await EmailOTP.findOne({
      email: cleanEmail,
      purpose: "password-reset",
    });

    if (!otpRecord || otpRecord.expiresAt <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP is invalid or expired. Please request a new one.",
      });
    }

    if (otpRecord.attempts >= 5) {
      await EmailOTP.deleteOne({ _id: otpRecord._id });

      return res.status(429).json({
        success: false,
        message: "Too many attempts. Please request a new OTP.",
      });
    }

    const isMatch = await bcrypt.compare(otp, otpRecord.otpHash);

    if (!isMatch) {
      otpRecord.attempts += 1;
      await otpRecord.save();

      return res.status(400).json({
        success: false,
        message: "Incorrect OTP.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    user.passwordResetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.passwordResetTokenExpiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    await user.save();

    await EmailOTP.deleteOne({ _id: otpRecord._id });

    return res.status(200).json({
      success: true,
      message: "OTP verified. You can now set a new password.",
      resetToken,
    });
  } catch (error) {
    console.error("Verify reset OTP error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to verify OTP right now.",
    });
  }
});


router.post("/reset-password", async (req, res) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;
    const password = newPassword;

    if (
      typeof resetToken !== "string" ||
      !resetToken ||
      typeof password !== "string" ||
      typeof confirmPassword !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid reset token and password details.",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    if (
      password.length < 8 ||
      password.length > 128 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must contain at least 8 characters, including uppercase, lowercase, number and special character.",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetTokenExpiresAt: { $gt: new Date() },
      isEmailVerified: true,
    }).select("+passwordResetTokenHash +passwordResetTokenExpiresAt");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Reset token is invalid or expired. Please verify your OTP again.",
      });
    }

    user.password = await bcrypt.hash(password, 12);

    // Invalidate previously issued login tokens.
    user.tokenVersion = (user.tokenVersion || 0) + 1;

    // Make the reset token unusable after this password change.
    user.passwordResetTokenHash = undefined;
    user.passwordResetTokenExpiresAt = undefined;

    await user.save();

    await EmailOTP.deleteMany({
      email: user.email,
      purpose: "password-reset",
    });

    return res.status(200).json({
      success: true,
      message: "Password reset successful. Please log in again.",
    });
  } catch (error) {
    console.error("Reset password error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to reset password right now.",
    });
  }
});
 
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "name email role profileImage isEmailVerified createdAt authProvider"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        authProvider: user.authProvider,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve user details.",
    });
  }
});



router.patch("/me", authMiddleware, async (req, res) => {
  const { name } = req.body || {};
  const cleanName = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";

  if (cleanName.length < 2 || cleanName.length > 80) {
    return res.status(400).json({
      success: false,
      message: "Name must be between 2 and 80 characters.",
    });
  }
  if (!PROFILE_NAME_PATTERN.test(cleanName)) {
    return res.status(400).json({
      success: false,
      message: "Use letters and separate name parts with spaces, hyphens, apostrophes, or periods.",
    });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { name: cleanName } },
      { new: true, runValidators: true }
    ).select("name email role profileImage isEmailVerified createdAt authProvider");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        authProvider: user.authProvider,
      },
    });
  } catch (error) {
    console.error("Update current user error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to update your profile right now.",
    });
  }
});

router.post("/me/profile-image", authMiddleware, async (req, res) => {
  const imageDataUrl = req.body?.imageDataUrl;
  const imageMatch = typeof imageDataUrl === "string"
    ? /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(imageDataUrl)
    : null;

  if (!imageMatch || imageMatch[1].length > 1_400_000) {
    return res.status(400).json({
      success: false,
      message: "Choose a valid JPG, PNG, or WebP image under 10 MB.",
    });
  }

  const imageBytes = Buffer.from(imageMatch[1], "base64");
  if (
    imageBytes.length > 1_000_000 ||
    imageBytes.length < 4 ||
    imageBytes[0] !== 0xff ||
    imageBytes[1] !== 0xd8 ||
    imageBytes[2] !== 0xff
  ) {
    return res.status(413).json({
      success: false,
      message: "The photo could not be processed. Choose another image.",
    });
  }

  const filename = `${crypto.randomUUID()}.jpg`;
  const storedPath = path.join(profileImageDirectory, filename);
  const imageUrl = `${profileImageUrlPrefix}${filename}`;

  try {
    await fs.mkdir(profileImageDirectory, { recursive: true });
    await fs.writeFile(storedPath, imageBytes, { flag: "wx" });

    const user = await User.findById(req.user.id);
    if (!user) {
      await fs.unlink(storedPath).catch(() => {});
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const oldImageUrl = user.profileImage;
    user.profileImage = imageUrl;
    try {
      await user.save();
    } catch (error) {
      await fs.unlink(storedPath).catch(() => {});
      throw error;
    }
    await removeStoredProfileImage(oldImageUrl);

    return res.status(200).json({
      success: true,
      message: "Profile photo updated.",
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        authProvider: user.authProvider,
      },
    });
  } catch (error) {
    console.error("Update profile image error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to update your profile photo right now.",
    });
  }
});

router.delete("/me/profile-image", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const oldImageUrl = user.profileImage;
    user.profileImage = "";
    await user.save();
    await removeStoredProfileImage(oldImageUrl);

    return res.status(200).json({
      success: true,
      message: "Profile photo removed.",
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: "",
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        authProvider: user.authProvider,
      },
    });
  } catch (error) {
    console.error("Remove profile image error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to remove your profile photo right now.",
    });
  }
});

router.post("/me/change-email/request", authMiddleware, async (req, res) => {
  const rawEmail = req.body?.email;
  if (typeof rawEmail !== "string") {
    return res.status(400).json({ success: false, message: "Enter a valid email address." });
  }

  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: "Enter a valid email address." });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    if (!user.isEmailVerified) {
      return res.status(403).json({ success: false, message: "Verify your current email before changing it." });
    }
    if (email === user.email) {
      return res.status(400).json({ success: false, message: "That is already your current email." });
    }

    const existingUser = await User.findOne({ email, _id: { $ne: user._id } }).select("_id");
    if (existingUser) {
      return res.status(409).json({ success: false, message: "An account with that email already exists." });
    }

    const recentOTP = await EmailOTP.findOne({ userId: user._id, purpose: "email-change" });
    if (recentOTP && Date.now() - recentOTP.createdAt.getTime() < OTP_RESEND_MS) {
      const retryAfterSeconds = Math.max(
        1,
        OTP_RESEND_SECONDS - Math.floor((Date.now() - recentOTP.createdAt.getTime()) / 1000)
      );
      return res.status(429).json({
        success: false,
        message: `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
        retryAfterSeconds,
      });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    await EmailOTP.deleteMany({ userId: user._id, purpose: "email-change" });
    await EmailOTP.create({
      userId: user._id,
      email,
      otpHash: await bcrypt.hash(otp, 10),
      purpose: "email-change",
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
      attempts: 0,
    });

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "SkillBridge email change verification",
        text: `Your SkillBridge email-change code is ${otp}. It expires in 3 minutes. Do not share this code with anyone.`,
      });
    } catch (emailError) {
      await EmailOTP.deleteMany({ userId: user._id, purpose: "email-change" });
      console.error("Email change verification send failed:", emailError.message);
      return res.status(500).json({
        success: false,
        message: "Unable to send the verification code. Please try again later.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `A verification code was sent to ${email}.`,
      resendAfterSeconds: OTP_RESEND_SECONDS,
      expiresInSeconds: OTP_RESEND_SECONDS,
    });
  } catch (error) {
    console.error("Request email change error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to start the email change right now." });
  }
});

router.post("/me/change-email/verify", authMiddleware, async (req, res) => {
  const { email: rawEmail, otp } = req.body || {};
  if (
    typeof rawEmail !== "string" ||
    typeof otp !== "string" ||
    !/^\d{6}$/.test(otp)
  ) {
    return res.status(400).json({ success: false, message: "Enter a valid email and 6-digit code." });
  }

  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: "Enter a valid email address." });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    if (email === user.email) {
      return res.status(400).json({ success: false, message: "That is already your current email." });
    }

    const existingUser = await User.findOne({ email, _id: { $ne: user._id } }).select("_id");
    if (existingUser) {
      return res.status(409).json({ success: false, message: "An account with that email already exists." });
    }

    const otpRecord = await EmailOTP.findOne({
      userId: user._id,
      email,
      purpose: "email-change",
    });
    if (!otpRecord || otpRecord.expiresAt <= new Date()) {
      return res.status(400).json({ success: false, message: "That code is invalid or expired. Request a new one." });
    }
    if (otpRecord.attempts >= 5) {
      await EmailOTP.deleteOne({ _id: otpRecord._id });
      return res.status(429).json({ success: false, message: "Too many attempts. Request a new code." });
    }

    if (!(await bcrypt.compare(otp, otpRecord.otpHash))) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ success: false, message: "The verification code is incorrect." });
    }

    user.email = email;
    user.isEmailVerified = true;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    await EmailOTP.deleteMany({ userId: user._id, purpose: "email-change" });

    const token = require("jsonwebtoken").sign(
      { userId: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    return res.status(200).json({
      success: true,
      message: "Your email address has been updated and verified.",
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage || "",
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        authProvider: user.authProvider,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "An account with that email already exists." });
    }
    console.error("Verify email change error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to update your email right now." });
  }
});

router.patch("/me/password", authMiddleware, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body || {};

  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    return res.status(400).json({
      success: false,
      message: "Enter your current password and the new password twice.",
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "New passwords do not match.",
    });
  }

  if (
    newPassword.length < 8 ||
    newPassword.length > 128 ||
    !/[a-z]/.test(newPassword) ||
    !/[A-Z]/.test(newPassword) ||
    !/[0-9]/.test(newPassword) ||
    !/[^A-Za-z0-9]/.test(newPassword)
  ) {
    return res.status(400).json({
      success: false,
      message: "New password must be at least 8 characters and include uppercase, lowercase, number, and symbol.",
    });
  }

  try {
    const user = await User.findById(req.user.id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (user.authProvider !== "local" || !user.password) {
      return res.status(400).json({
        success: false,
        message: "This account uses Google sign-in. Change its password through Google.",
      });
    }

    const currentPasswordMatches = await bcrypt.compare(currentPassword, user.password);
    if (!currentPasswordMatches) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    if (await bcrypt.compare(newPassword, user.password)) {
      return res.status(400).json({
        success: false,
        message: "Choose a new password different from your current one.",
      });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    const token = require("jsonwebtoken").sign(
      {
        userId: user._id.toString(),
        role: user.role,
        tokenVersion: user.tokenVersion,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      success: true,
      message: "Password updated successfully.",
      token,
    });
  } catch (error) {
    console.error("Update password error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to change your password right now.",
    });
  }
});

router.post("/google", async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "Google ID token is required.",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.sub || !payload.email) {
      return res.status(401).json({
        success: false,
        message: "Invalid Google account information.",
      });
    }

    if (payload.email_verified !== true) {
      return res.status(401).json({
        success: false,
        message: "Google email is not verified.",
      });
    }

    const email = payload.email.toLowerCase();

    let user = await User.findOne({
      $or: [
        { googleId: payload.sub },
        { email },
      ],
    });

    if (user) {
      if (user.role !== "student") {
        return res.status(401).json({
          success: false,
          message: "Unable to sign in with this account.",
        });
      }

      if (user.isBlocked) {
        return res.status(403).json({
          success: false,
          message: "Your account is blocked.",
        });
      }

      if (user.authProvider === "local") {
        return res.status(409).json({
          success: false,
          message:
            "An account already exists with this email. Please sign in using your password.",
        });
      }

      if (user.googleId && user.googleId !== payload.sub) {
        return res.status(409).json({
          success: false,
          message: "This email is linked to another Google account.",
        });
      }

      user.googleId = payload.sub;
      user.authProvider = "google";
      user.isEmailVerified = true;

      if (!user.name) {
        user.name = payload.name || email.split("@")[0];
      }

      if (!user.profileImage && payload.picture) {
        user.profileImage = payload.picture;
      }

      await user.save();
    } else {
      user = await User.create({
        name: payload.name || email.split("@")[0],
        email,
        googleId: payload.sub,
        authProvider: "google",
        role: "student",
        isEmailVerified: true,
        profileImage: payload.picture || "",
      });
    }

    const token = require("jsonwebtoken").sign(
      {
        userId: user._id.toString(),
        role: user.role,
        tokenVersion: user.tokenVersion || 0,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      success: true,
      message: "Google authentication successful.",
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage || "",
        authProvider: user.authProvider,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    console.error("Google authentication error:", error.message);

    return res.status(401).json({
      success: false,
      message: "Google authentication failed. Please try again.",
    });
  }
});


module.exports = router;




