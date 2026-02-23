const express = require("express");
const router = express.Router();

const interviewController = require("../controllers/interview.controller");
const { authorize,verifyToken } = require('../middlewares/auth.middleware');


const multer = require("multer");
const upload = multer();

// Create Candidate
router.post(
  "/",
  verifyToken,
  authorize("Admin", "HR"),
  upload.single("resume"),
  interviewController.createInterview
);

// List Candidates
router.get(
  "/",
  verifyToken,
  authorize("Admin", "HR"),
  interviewController.getInterviewList
);

// Candidate Detail
router.get(
  "/:id",
  verifyToken,
  authorize("Admin", "HR"),
  interviewController.getInterviewDetail
);

// Update Status
router.patch(
  "/status/:id",
  verifyToken,
  authorize("Admin", "HR"),
  interviewController.updateInterviewStatus
);

module.exports = router;
