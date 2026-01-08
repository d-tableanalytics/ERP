const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

// @route   POST /api/auth/register
// @desc    Register a new employee
// @access  Public (Can be restricted to Admin later)
router.post('/register', authController.register);

// @route   POST /api/auth/login
// @desc    Login employee & get token
// @access  Public
router.post('/login', authController.login);

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', verifyToken, (req, res) => {
    res.json(req.user);
});

module.exports = router;
