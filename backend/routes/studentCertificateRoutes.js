const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const controller = require("../controllers/studentCertificateController");

router.use(authMiddleware, requireRole("student"));
router.get("/my", controller.listMine);
router.get("/:certificateId/download", controller.downloadCertificate);
router.get("/:code", controller.getCertificate);

module.exports = router;
