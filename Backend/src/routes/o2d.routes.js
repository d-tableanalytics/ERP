const express = require("express");
const router = express.Router();
const o2dController = require("../controllers/o2d.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

router.post("/", verifyToken, o2dController.createO2DOrder);
router.get("/", verifyToken, o2dController.getAllO2DOrders);
router.get("/summary", verifyToken, o2dController.getO2DSummary);
router.get("/alerts", verifyToken, o2dController.getO2DAlerts);
router.get("/overdue", verifyToken, o2dController.getO2DOverdueOrders);
router.get("/po/:poNumber", verifyToken, o2dController.getO2DOrderByPO);
router.get("/step/:stepName", verifyToken, o2dController.getO2DOrdersByStep);
router.patch("/orders/:orderId/step", verifyToken, o2dController.updateO2DStep);
router.patch("/orders/:orderId/current-step", verifyToken, o2dController.correctO2DStep);
router.post("/orders/:orderId/remarks", verifyToken, o2dController.addO2DRemark);
router.get("/orders/:orderId/history", verifyToken, o2dController.getO2DStepHistory);

router.patch(
  "/orders/:orderId/steps/:stepId/assign",
  verifyToken,
  o2dController.assignO2DStep
);

router.patch(
  "/orders/:orderId/steps/:stepId/complete",
  verifyToken,
  o2dController.completeO2DStep
);

module.exports = router;
