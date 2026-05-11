const express = require('express');
const router = express.Router();
const notificationPrefController = require('../controllers/notificationPreference.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.get('/', notificationPrefController.getNotificationSettings);
router.post('/', notificationPrefController.updateNotificationSettings);

module.exports = router;
