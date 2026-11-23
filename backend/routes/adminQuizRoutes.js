const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const controller = require("../controllers/adminQuizController");

router.use(authMiddleware, requireRole("admin"));
router.route("/courses/:courseId").get(controller.getForCourse).put(controller.saveForCourse);

module.exports = router;
