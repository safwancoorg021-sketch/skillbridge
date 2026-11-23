const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const controller = require("../controllers/wishlistController");

router.use(authMiddleware, requireRole("student"));
router.get("/", controller.listMine);
router.post("/:courseId", controller.addCourse);
router.delete("/:courseId", controller.removeCourse);

module.exports = router;
