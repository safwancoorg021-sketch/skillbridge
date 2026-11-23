
const dotenv = require("dotenv");
dotenv.config();

const loadRuntimeSecrets = require("./config/loadRuntimeSecrets");
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");

const app = express();

const startServer = async () => {
  try {
    await loadRuntimeSecrets();

    const trustedProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS || "0", 10);
    if (Number.isInteger(trustedProxyHops) && trustedProxyHops > 0) {
      app.set("trust proxy", trustedProxyHops);
    }

    const allowedOrigins = new Set(
      (process.env.CORS_ORIGINS || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    );
    app.use(cors({
      origin(origin, callback) {
        // The production frontend is served by this API, so cross-origin browser
        // access is disabled unless a separate frontend origin is configured.
        callback(null, Boolean(origin && allowedOrigins.has(origin)));
      },
    }));
    app.use("/api/payments/webhook", express.raw({ type: "application/json", limit: "1mb" }));
    app.use(express.json({ limit: "2mb" }));

    // Load routes only after runtime secrets are available because some route
    // modules initialize their clients from process.env when they are imported.
    app.use("/api/auth", require("./routes/auth"));
    app.use("/api/admin/users", require("./routes/adminUsers"));
    app.use("/api/courses", require("./routes/courseRoutes"));
    app.use("/api/lessons", require("./routes/lessonRoutes"));
    app.use("/api/enrollments", require("./routes/enrollmentRoutes"));
    app.use("/api/quizzes", require("./routes/studentQuizRoutes"));
    app.use("/api/certificates", require("./routes/studentCertificateRoutes"));
    app.use("/api/wishlist", require("./routes/wishlistRoutes"));
    app.use("/api/admin/lessons", require("./routes/adminLessonRoutes"));
    app.use("/uploads/course-videos", (_req, res) => {
      res.status(404).json({ success: false, message: "Course videos are available only through the lesson player." });
    });
    app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
      dotfiles: "deny",
      maxAge: "1d",
      immutable: true,
    }));
    app.use("/app", express.static(path.join(__dirname, "..", "frontend", "dist")));
    app.use("/api/admin/courses", require("./routes/adminCourseRoutes"));
    app.use("/api/admin/quizzes", require("./routes/adminQuizRoutes"));
    app.use("/api/admin/commerce", require("./routes/adminCommerceRoutes"));
    app.use("/api/admin/support", require("./routes/adminSupportRoutes"));
    app.use("/api/cart", require("./routes/cartRoutes"));
    app.use("/api/payments", require("./routes/paymentRoutes"));
    app.use("/api/offers", require("./routes/offerRoutes"));
    app.use("/api/notifications", require("./routes/studentNotificationRoutes"));
    app.use("/api/support", require("./routes/supportRoutes"));

    app.get("/api/health", (_req, res) => {
      res.json({ success: true, service: "SkillBridge API", courseThumbnailUpload: true });
    });
    app.get("/", (_req, res) => res.redirect(302, "/app/"));

    await connectDB();

    const PORT = process.env.PORT || (process.env.NODE_ENV === "production" ? 3000 : 5001);

    app.listen(PORT, () => {
      console.log(`SkillBridge server running on port ${PORT} from ${__dirname}`);
    });
  } catch (error) {
    console.error("Failed to start SkillBridge:", error.message);
    process.exit(1);
  }
};

startServer();

