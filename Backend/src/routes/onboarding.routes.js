const express = require("express");
const router = express.Router();

const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });

const onboardingController = require("../controllers/onboarding.controller");
const { verifyToken } = require('../middlewares/auth.middleware');

// ✅ Create Onboarding + Upload Docs
router.post(
  "/",
  verifyToken,
  upload.fields([
    { name: "joining_docs", maxCount: 6 }, // Aadhaar, PAN, Resume
  ]),
  onboardingController.createOnboarding
);

// ✅ Get List (Role Based)
router.get("/", verifyToken, onboardingController.getOnboardingList);

// ✅ Approve (HR/Admin)
router.patch(
  "/approve/:id",
  verifyToken,
  onboardingController.approveOnboarding
);

// ✅ Reject (HR/Admin)
router.patch(
  "/reject/:id",
  verifyToken,
  onboardingController.rejectOnboarding
);

module.exports = router;
