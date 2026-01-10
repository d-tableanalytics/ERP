const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employee.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.get('/employees', verifyToken, employeeController.getAllEmployees);
router.get('/departments', verifyToken, employeeController.getDepartments);

module.exports = router;
