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

// -------------------------
// APPROVAL WORKFLOW ROUTES
// -------------------------
router.get('/approvals/pending', authorize('SuperAdmin', 'Admin'), taskController.getPendingApprovals);
router.get('/approvals/approved', authorize('SuperAdmin', 'Admin'), taskController.getApprovedTasks);
router.get('/approvals/rejected', authorize('SuperAdmin', 'Admin'), taskController.getRejectedTasks);
router.patch('/:id/approve', authorize('SuperAdmin', 'Admin'), taskController.approveTask);
router.patch('/:id/reject', authorize('SuperAdmin', 'Admin'), taskController.rejectTask);


// GET /api/tasks/:id - Task detail
router.get('/:id', taskController.getTaskById);

// POST /api/tasks/:id/remarks - Add remark to task
router.post('/:id/remarks', taskController.addTaskRemark);

// PATCH /api/tasks/:id/subscribe - Subscribe to task
router.patch('/:id/subscribe', taskController.subscribeToTask);

// PATCH /api/tasks/:id - Partial update task
router.patch(
    '/:id',
    authorize('SuperAdmin', 'Admin', 'Employee'),
    upload.fields([
        { name: 'voice_note', maxCount: 1 },
        { name: 'reference_docs', maxCount: 20 },
        { name: 'evidence_files', maxCount: 20 }
    ]),
    taskController.updateTask
);

// PUT /api/tasks/:id - Full update task
router.put(
    '/:id',
    authorize('SuperAdmin', 'Admin', 'Employee'),
    upload.fields([
        { name: 'voice_note', maxCount: 1 },
        { name: 'reference_docs', maxCount: 20 },
        { name: 'evidence_files', maxCount: 20 }
    ]),
    taskController.updateTask
);

// PATCH /api/tasks/:id/trash - Soft delete a task
router.patch(
    '/:id/trash',
    authorize('SuperAdmin', 'Admin'),
    taskController.softDeleteTask
);

// PATCH /api/tasks/:id/restore - Restore a deleted task
router.patch(
    '/:id/restore',
    authorize('SuperAdmin', 'Admin'),
    taskController.restoreTask
);

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
