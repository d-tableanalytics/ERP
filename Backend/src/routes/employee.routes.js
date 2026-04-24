const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employee.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.get('/employees', verifyToken, employeeController.getAllEmployees);
router.get('/departments', verifyToken, employeeController.getDepartments);
router.post('/departments', verifyToken, employeeController.createDepartment);
router.put('/departments/:id', verifyToken, employeeController.updateDepartment);
router.delete('/departments/:id', verifyToken, employeeController.deleteDepartment);
router.get('/pc-accountables', verifyToken, employeeController.getPCAccountables);
router.get('/problem-solvers', verifyToken, employeeController.getProblemSolvers);
router.get('/locations', verifyToken, employeeController.getLocations);
router.delete('/employees/:id', verifyToken, employeeController.deleteEmployee);

module.exports = router;
