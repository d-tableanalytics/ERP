const express = require('express');
const router = express.Router();
const delegationController = require('../controllers/delegation.controller');
const { verifyToken, authorize } = require('../middlewares/auth.middleware');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.memoryStorage();
const upload = multer({ storage });

// All routes require authentication
router.use(verifyToken);

// GET /api/delegations - Get all (Admin/SuperAdmin) or assigned (Doer)
router.get('/', delegationController.getDelegations);

// GET /api/delegations/:id - Get details
router.get('/:id', delegationController.getDelegationDetail);

// POST /api/delegations - Only Admin/SuperAdmin/Employee can create
router.post('/',
    authorize('SuperAdmin', 'Admin', 'Employee'),
    upload.fields([
        { name: 'voice_note', maxCount: 1 },
        { name: 'reference_docs', maxCount: 5 }
    ]),
    delegationController.createDelegation
);

// POST /api/delegations/:id/remarks - Doer or Admin can add remarks
router.post('/:id/remarks', delegationController.addRemark);

module.exports = router;
