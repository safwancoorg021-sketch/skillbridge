const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const controller = require("../controllers/supportController");

router.use(authMiddleware, requireRole("admin"));
router.get("/", controller.listAll);
router.patch("/:id", controller.update);

module.exports = router;
