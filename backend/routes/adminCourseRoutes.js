const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const controller = require("../controllers/adminCourseController");

router.use(authMiddleware, requireRole("admin"));
router.get("/", controller.getAllCourses);
router.post("/", controller.createCourse);
router.get("/:id", controller.getCourse);
router.put("/:id", controller.updateCourse);
router.delete("/:id", controller.deleteCourse);
router.patch("/:id/publish", controller.togglePublish);

module.exports = router;
