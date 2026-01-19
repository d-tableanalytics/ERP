const express = require('express');
const router = express.Router();
const checklistController = require('../controllers/checklist.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

// Apply authentication to all checklist routes
router.use(verifyToken);

// Checklist Master Routes (Templates)
router.post('/master', checklistController.createChecklistMaster);
router.put('/master/:id', checklistController.updateChecklistMaster);
router.delete('/master/:id', checklistController.deleteChecklistMaster);

// Configure Multer for proof file uploads
const multer = require('multer');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Checklist Task Routes (Instances)
router.get('/', checklistController.getChecklists); // Fetch all
// Status update (now with optional file upload)
router.patch('/task/:id', upload.single('proof_file'), checklistController.updateChecklistStatus);
router.put('/task/:id', checklistController.updateChecklistTaskDetails); // Full edit
router.delete('/task/:id', checklistController.deleteChecklistTask);

// TEST ROUTE: Trigger daily generation immediately
router.get('/test-generation', (req, res) => {
    checklistController.generateDailyTasks();
    res.send('Checklist generation triggered! Check server logs.');
});

module.exports = router;
