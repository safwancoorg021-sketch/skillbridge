const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const controller = require("../controllers/studentCourseController");
const videoController = require("../controllers/courseVideoController");

router.route("/videos/:filename").get(videoController.streamVideo).head(videoController.streamVideo);
router.delete("/video-access", videoController.clearVideoAccess);
router.use(authMiddleware, requireRole("student"));
router.get("/:lessonId", controller.getLesson);
router.post("/:lessonId/complete", controller.markLessonComplete);

module.exports = router;
