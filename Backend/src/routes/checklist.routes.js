const express = require('express');
const router = express.Router();
const checklistController = require('../controllers/checklist.controller');

// Checklist Master Routes (Templates)
router.post('/master', checklistController.createChecklistMaster);
router.put('/master/:id', checklistController.updateChecklistMaster);
router.delete('/master/:id', checklistController.deleteChecklistMaster);

// Checklist Task Routes (Instances)
router.patch('/task/:id', checklistController.updateChecklistStatus);
router.delete('/task/:id', checklistController.deleteChecklistTask);

// TEST ROUTE: Trigger daily generation immediately
router.get('/test-generation', (req, res) => {
    checklistController.generateDailyTasks();
    res.send('Checklist generation triggered! Check server logs.');
});

module.exports = router;
