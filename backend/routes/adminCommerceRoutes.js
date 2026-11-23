const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const controller = require("../controllers/adminCommerceController");

router.use(authMiddleware, requireRole("admin"));
router.get("/payments", controller.listPayments);
router.get("/reports", controller.getReports);
router.route("/coupons").get(controller.listCoupons).post(controller.createCoupon);
router.route("/coupons/:id").put(controller.updateCoupon).delete(controller.deleteCoupon);
router.route("/offers").get(controller.listOffers).post(controller.createOffer);
router.route("/offers/:id").put(controller.updateOffer).delete(controller.deleteOffer);

module.exports = router;
