const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const controller = require("../controllers/paymentController");

router.post("/webhook", controller.handleWebhook);
router.use(authMiddleware, requireRole("student"));
router.post("/preview", controller.previewOrder);
router.post("/coupons/validate", controller.validateCoupon);
router.post("/orders", controller.createOrder);
router.post("/verify", controller.verifyPayment);
router.get("/my", controller.listMine);
router.get("/:paymentId/invoice", controller.downloadInvoice);
router.post("/:paymentId/refund", controller.requestRefund);

module.exports = router;
