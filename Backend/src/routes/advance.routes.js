const express = require('express');
const router = express.Router();
const advanceController = require('../controllers/advance.controller');
const { verifyToken , authorize} = require('../middlewares/auth.middleware');


router.post('/', verifyToken, advanceController.createAdvanceRequest);
router.get('/', verifyToken, advanceController.getAdvanceList);


router.patch('/approve/:id', 
    verifyToken,
    authorize('SuperAdmin', 'Admin'),
    advanceController.approveAdvance);

router.patch('/reject/:id',  
    verifyToken,
    authorize('SuperAdmin', 'Admin'),
    advanceController.rejectAdvance);


module.exports = router;
