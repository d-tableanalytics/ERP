const db = require('../config/db.config');
const { uploadToDrive } = require('../utils/googleDrive');
const { createNotification } = require('../utils/notification');
const { Task } = require('../models/task.model');
const { notifyUser } = require('../services/notificationService');
const delegationController = require('./delegation.controller');

// Helper to calculate reminder time
const calculateReminderTime = (dueDate, timeValue, timeUnit, triggerType) => {
    if (!dueDate) return null;
    let date = new Date(dueDate);
    if (isNaN(date.getTime())) return null;
    let value = parseInt(timeValue);
    let ms = 0;
    if (timeUnit === 'minutes') ms = value * 60 * 1000;
    else if (timeUnit === 'hours') ms = value * 60 * 60 * 1000;
    else if (timeUnit === 'days') ms = value * 24 * 60 * 60 * 1000;

    return triggerType === 'before' 
        ? new Date(date.getTime() - ms)
        : new Date(date.getTime() + ms);
};

/**
 * NEW Task Controller
 */

// 1. My Tasks - Tasks assigned to the current user (Doer)
exports.getMyTasks = async (req, res) => {
    const userId = req.user.id || req.user.User_Id;
    try {
        const tasks = await Task.findMyTasks(userId);
        res.status(200).json({
            success: true,
            count: tasks.length,
            data: tasks
        });
    } catch (err) {
        console.error('Error in getMyTasks:', err);
        res.status(500).json({ success: false, message: 'Error fetching my tasks' });
    }
};

// 2. Delegated Tasks - Tasks created/assigned BY the current user to others
exports.getDelegatedTasks = async (req, res) => {
    const userId = req.user.id || req.user.User_Id;
    try {
        const tasks = await Task.findDelegatedTasks(userId);
        res.status(200).json({
            success: true,
            count: tasks.length,
            data: tasks
        });
    } catch (err) {
        console.error('Error in getDelegatedTasks:', err);
        res.status(500).json({ success: false, message: 'Error fetching delegated tasks' });
    }
};

// 3. Subscribed Tasks - Tasks where the user is in subscribed_by or in_loop_ids
exports.getSubscribedTasks = async (req, res) => {
    const userId = req.user.id || req.user.User_Id;
    try {
        const tasks = await Task.findSubscribedTasks(userId);
        res.status(200).json({
            success: true,
            count: tasks.length,
            data: tasks
        });
    } catch (err) {
        console.error('Error in getSubscribedTasks:', err);
        res.status(500).json({ success: false, message: 'Error fetching subscribed tasks' });
    }
};

// 4. All Tasks - Admin gets all, others get tasks they are involved in
exports.getAllTasks = async (req, res) => {
    const userId = req.user.id || req.user.User_Id;
    const { role } = req.user;
    try {
        const isAdmin = role === 'Admin' || role === 'SuperAdmin';
        const tasks = await Task.findAll({}, isAdmin ? null : userId);
        res.status(200).json({
            success: true,
            count: tasks.length,
            data: tasks
        });
    } catch (err) {
        console.error('Error in getAllTasks:', err);
        res.status(500).json({ success: false, message: 'Error fetching all tasks' });
    }
};

// 5. Deleted Tasks - Tasks that have been soft deleted
exports.getDeletedTasks = async (req, res) => {
    try {
        const tasks = await Task.findDeletedTasks();
        res.status(200).json({
            success: true,
            count: tasks.length,
            data: tasks
        });
    } catch (err) {
        console.error('Error in getDeletedTasks:', err);
        res.status(500).json({ success: false, message: 'Error fetching deleted tasks' });
    }
};

// 6. Soft Delete Task
exports.softDeleteTask = async (req, res) => {
    const { id } = req.params;
    const deletedBy = req.user.email || req.user.name || req.user.role || 'System';
    try {
        const task = await Task.softDelete(id, deletedBy);
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        // Trigger notification
        await notifyUser('TASK_DELETED', {
            ...task,
            triggeredById: req.user.id || req.user.User_Id,
            changedBy: deletedBy
        });

        res.status(200).json({ success: true, data: task });
    } catch (err) {
        console.error('Error soft deleting task:', err);
        res.status(500).json({ success: false, message: 'Error deleting task' });
    }
};

// 7. Restore Task
exports.restoreTask = async (req, res) => {
    const { id } = req.params;
    try {
        const task = await Task.restore(id);
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }
        res.status(200).json({ success: true, data: task });
    } catch (err) {
        console.error('Error restoring task:', err);
        res.status(500).json({ success: false, message: 'Error restoring task' });
    }
};

// 8. Get Task Detail
exports.getTaskById = async (req, res) => {
    const { id } = req.params;
    try {
        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }
        return delegationController.getDelegationDetail(req, res);
    } catch (err) {
        console.error('Error in getTaskById:', err);
        return res.status(500).json({ success: false, message: 'Error fetching task detail' });
    }
};

// 9. Update Task
exports.updateTask = async (req, res) => {
    const { id } = req.params;
    try {
        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }
        return delegationController.updateDelegation(req, res);
    } catch (err) {
        console.error('Error in updateTask:', err);
        return res.status(500).json({ success: false, message: 'Error updating task' });
    }
};

// 10. Add Task Remark
exports.addTaskRemark = async (req, res) => {
    const { id } = req.params;
    try {
        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }
        return delegationController.addRemark(req, res);
    } catch (err) {
        console.error('Error in addTaskRemark:', err);
        return res.status(500).json({ success: false, message: 'Error adding task remark' });
    }
};

// 11. Subscribe to Task
exports.subscribeToTask = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id || req.user.User_Id;
    try {
        const task = await Task.subscribe(id, userId);
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found or already subscribed' });
        }
        res.status(200).json({ success: true, data: task });
    } catch (err) {
        console.error('Error subscribing to task:', err);
        res.status(500).json({ success: false, message: 'Error subscribing to task' });
    }
};

// 12. Create Task
exports.createTask = async (req, res) => {
    const {
        taskTitle, delegation_name,
        description,
        assignerId, delegator_id,
        assignerName, delegator_name,
        doerId, doer_id,
        department,
        priority,
        dueDate, due_date,
        evidenceRequired, evidence_required,
        category,
        tags,
        checklistItems, checklist,
        repeatSettings, repeat_settings,
        inLoopIds, in_loop_ids,
        groupId, group_id,
        parentId, parent_id,
        reminders
    } = req.body;

    const final_name = taskTitle || delegation_name;
    const final_delegator_id = parseInt(assignerId || delegator_id || req.user.id);
    const final_assigner_name = assignerName || delegator_name || req.user.name || 'User';
    const final_department = department || null;

    let rawDoerIds = doerId || doer_id;
    if (!Array.isArray(rawDoerIds)) {
        rawDoerIds = rawDoerIds ? [rawDoerIds] : [];
    }
    const final_doer_ids = rawDoerIds.map(id => parseInt(id)).filter(id => !isNaN(id));
    
    const final_due_date = dueDate || due_date;
    const final_evidence_req = evidenceRequired === 'true' || evidenceRequired === true || evidence_required === 'true' || evidence_required === true;
    
    // Parse JSON strings from FormData safely
    const safeParse = (str, fallback) => {
        if (!str || str === 'undefined' || str === 'null' || str === '') return fallback;
        try {
            return JSON.parse(str);
        } catch (e) {
            console.error(`JSON Parse Error for: ${str}`, e);
            return fallback;
        }
    };

    const final_checklist = safeParse(checklistItems || checklist, []);
    const final_in_loop = safeParse(inLoopIds || in_loop_ids, []);
    const final_repeat = safeParse(repeatSettings || repeat_settings, {});
    const final_reminders = safeParse(reminders, []);
    const final_tags = safeParse(tags, []);

    let voice_note_url = null;
    let reference_docs = [];

    try {
        if (req.files && req.files['voice_note']) {
            const file = req.files['voice_note'][0];
            voice_note_url = await uploadToDrive(file.buffer, file.originalname, file.mimetype);
        }
        if (req.files && req.files['reference_docs']) {
            const docs = await Promise.all(req.files['reference_docs'].map(async (f) => {
                return await uploadToDrive(f.buffer, f.originalname, f.mimetype);
            }));
            reference_docs = docs.filter(u => u !== null);
        }
    } catch (e) { console.error('Upload error:', e); }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const results = [];

        for (const targetDoerId of final_doer_ids) {
            // Fetch doer name from employees table if not provided
            let final_doer_name = 'Unknown';
            const userRes = await client.query('SELECT first_name, last_name FROM employees WHERE user_id = $1', [targetDoerId]);
            if (userRes.rows.length > 0) {
                const u = userRes.rows[0];
                final_doer_name = `${u.first_name || ''} ${u.last_name || ''}`.trim();
            }

            const newTask = await Task.create({
                delegation_name: final_name,
                description,
                delegator_id: final_delegator_id,
                delegator_name: final_assigner_name,
                doer_id: targetDoerId,
                doer_name: final_doer_name,
                department: final_department,
                priority,
                due_date: final_due_date,
                voice_note_url,
                reference_docs,
                evidence_required: final_evidence_req,
                category,
                tags: final_tags,
                checklist: final_checklist,
                repeat_settings: final_repeat,
                in_loop_ids: final_in_loop,
                group_id: groupId || group_id,
                parent_id: parentId || parent_id
            }, client);

            results.push(newTask);

            // Reminders support
            if (final_reminders.length > 0) {
                for (const r of final_reminders) {
                    const rTime = calculateReminderTime(final_due_date, r.timeValue, r.timeUnit, r.triggerType);
                    await client.query(
                        'INSERT INTO task_reminders (delegation_id, type, time_value, time_unit, trigger_type, reminder_time) VALUES ($1, $2, $3, $4, $5, $6)',
                        [newTask.id, r.type, r.timeValue, r.timeUnit, r.triggerType, rTime]
                    );
                }
            }

            // Notification
            if (targetDoerId !== final_delegator_id) {
                await notifyUser('TASK_CREATED', {
                    ...newTask,
                    triggeredById: final_delegator_id
                });
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ success: true, data: results });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('Error creating task:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error creating task',
            error: err.message
        });
    } finally { 
        if (client) client.release(); 
    }
};
