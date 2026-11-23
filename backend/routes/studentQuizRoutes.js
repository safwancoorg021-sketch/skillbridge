const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const controller = require("../controllers/studentQuizController");

router.use(authMiddleware, requireRole("student"));
router.get("/:courseId", controller.getQuiz);
router.post("/:courseId/submit", controller.submitQuiz);
router.get("/:quizId/result", controller.getResult);

module.exports = router;
