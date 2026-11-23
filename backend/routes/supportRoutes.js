const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const controller = require("../controllers/supportController");

router.use(authMiddleware, requireRole("student"));
router.get("/", controller.listMine);
router.post("/", controller.create);

module.exports = router;
