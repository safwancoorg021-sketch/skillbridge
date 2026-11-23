const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const controller = require("../controllers/adminCommerceController");

router.use(authMiddleware, requireRole("student"));
router.get("/", controller.listStudentOffers);

module.exports = router;
