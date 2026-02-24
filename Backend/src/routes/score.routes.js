const express = require('express');
const router = express.Router();
const scoreController = require('../controllers/score.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

// All routes require authentication
router.use(verifyToken);

router.get('/', scoreController.getScore);
router.get('/summary', scoreController.getScoreSummary);

module.exports = router;
