const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');


router.post('/register', authController.register);

router.post('/login', authController.login);

router.put('/theme', verifyToken, authController.updateTheme);

router.get('/me', verifyToken, authController.getMe);
router.get('/users', verifyToken, authController.getUsers);

module.exports = router;
