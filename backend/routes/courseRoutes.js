const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const controller = require("../controllers/studentCourseController");
const reviewController = require("../controllers/courseReviewController");

router.use(authMiddleware, requireRole("student"));
router.get("/", controller.listCourses);
router.get("/:courseId/lessons", controller.listCourseLessons);
router.get("/:courseId/reviews", reviewController.listForCourse);
router.post("/:courseId/reviews", reviewController.addForCourse);
router.get("/:courseId", controller.getCourse);
router.post("/:courseId/enroll", controller.enroll);

module.exports = router;
