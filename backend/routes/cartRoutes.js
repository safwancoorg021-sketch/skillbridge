const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const controller = require("../controllers/cartController");

router.use(authMiddleware, requireRole("student"));
router.get("/", controller.getCart);
router.post("/items", controller.addItem);
router.delete("/items/:courseId", controller.removeItem);

module.exports = router;
