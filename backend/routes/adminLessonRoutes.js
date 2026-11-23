const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const videoUpload = require("../middleware/videoUpload");
const controller = require("../controllers/adminLessonController");

router.use(authMiddleware, requireRole("admin"));
router.get("/courses/:courseId/curriculum", controller.getCurriculum);
router.post("/courses/:courseId/modules", controller.addModule);
router.route("/modules/:moduleId").put(controller.updateModule).delete(controller.deleteModule);
router.post("/modules/:moduleId/lessons", videoUpload.receiveVideo, videoUpload.compressUploadedVideo, controller.addLesson);
router.put("/lessons/:lessonId", videoUpload.receiveVideo, videoUpload.compressUploadedVideo, controller.updateLesson);
router.route("/lessons/:lessonId").delete(controller.deleteLesson);

module.exports = router;
