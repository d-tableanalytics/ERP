const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');

// get all list of attendance
router.get('/', attendanceController.getAttendanceList);
// Punch In
router.post('/punch-in', attendanceController.punchIn);

// Punch Out
router.post('/punch-out', attendanceController.punchOut);

module.exports = router;
