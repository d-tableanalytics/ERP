const express = require('express');
const router = express.Router();
const delegationController = require('../controllers/delegation.controller');
const { verifyToken, authorize } = require('../middlewares/auth.middleware');

// All routes require authentication
router.use(verifyToken);

// GET /api/delegations - Get all (Admin/SuperAdmin) or assigned (Doer)
router.get('/', delegationController.getDelegations);

// GET /api/delegations/:id - Get details
router.get('/:id', delegationController.getDelegationDetail);

// POST /api/delegations - Only Admin/SuperAdmin/Employee can create
router.post('/', authorize('SuperAdmin', 'Admin', 'Employee'), delegationController.createDelegation);

// POST /api/delegations/:id/remarks - Doer or Admin can add remarks
router.post('/:id/remarks', delegationController.addRemark);

module.exports = router;
