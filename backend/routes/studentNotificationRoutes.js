const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const controller = require("../controllers/studentNotificationController");

router.use(authMiddleware, requireRole("student"));
router.get("/", controller.listMine);
router.patch("/read-all", controller.markAllRead);
router.patch("/:id/read", controller.markRead);

module.exports = router;
