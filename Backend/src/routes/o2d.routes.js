const express = require("express");
const router = express.Router();
const o2dController = require("../controllers/o2d.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

router.post("/", verifyToken, o2dController.createO2DOrder);
router.get("/", verifyToken, o2dController.getAllO2DOrders);

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