const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const { verifyToken, authorize } = require('../middlewares/auth.middleware');
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage });

// All routes require authentication
router.use(verifyToken);

/**
 * NEW Task Routes
 * These routes provide specific views of tasks (My Tasks, Delegated, Subscribed, etc.)
 */

// GET /api/tasks/my - Tasks assigned to the current user
router.get('/my', taskController.getMyTasks);

// GET /api/tasks/delegated - Tasks created/assigned BY the current user to others
router.get('/delegated', taskController.getDelegatedTasks);

// GET /api/tasks/subscribed - Tasks where the user is a subscriber or in loop
router.get('/subscribed', taskController.getSubscribedTasks);

// GET /api/tasks/all - Comprehensive view of all accessible tasks
router.get('/all', taskController.getAllTasks);

// GET /api/tasks/deleted - View tasks in the recycle bin
router.get('/deleted', taskController.getDeletedTasks);

// POST /api/tasks - Create new task(s)
router.post('/',
    authorize('SuperAdmin', 'Admin', 'Employee'),
    upload.fields([
        { name: 'voice_note', maxCount: 1 },
        { name: 'reference_docs', maxCount: 20 }
    ]),
    taskController.createTask
);

module.exports = router;
