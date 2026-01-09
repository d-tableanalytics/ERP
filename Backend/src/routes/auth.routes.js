const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');


router.post('/register', authController.register);

router.post('/login', authController.login);

router.get('/me', verifyToken, (req, res) => {
    res.json(req.user);
});



module.exports = router;
