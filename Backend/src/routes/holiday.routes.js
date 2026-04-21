const express = require('express');
const router = express.Router();
const holidayController = require('../controllers/holiday.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.use(verifyToken);

router.post('/', holidayController.createHoliday);
router.get('/', holidayController.getHolidays);
router.delete('/:id', holidayController.deleteHoliday);

module.exports = router;
