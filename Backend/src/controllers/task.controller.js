const db = require('../config/db.config');
const { uploadToDrive } = require('../utils/googleDrive');
const { createNotification } = require('../utils/notification');
const { Task } = require('../models/task.model');
const { notifyUser } = require('../services/notificationService');

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
        const deleted = await Task.softDelete(id, deletedBy);
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        // Re-fetch with BASE_QUERY to get properly aliased camelCase fields (taskTitle, assignerId, doerId …)
        const task = await Task.findById(id).catch(() => deleted);

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
        
        // Fetch remarks, revision history, and subtasks
        const remarks = await Task.getRemarks(id);
        const revisionHistory = await Task.getRevisionHistory(id);
        const subtasks = await Task.getSubtasks(id);

        res.status(200).json({ 
            success: true, 
            data: {
                ...task,
                remarks_list: remarks,
                revision_history_list: revisionHistory,
                subtasks: subtasks
            } 
        });
    } catch (err) {
        console.error('Error in getTaskById:', err);
        return res.status(500).json({ success: false, message: 'Error fetching task detail' });
    }
};

// 9. Update Task
exports.updateTask = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id || req.user.User_Id;
    const userName = req.user.name || 'User';

    try {
        const existingTask = await Task.findById(id);
        if (!existingTask) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        const updates = { ...req.body };
        
        // Handle file uploads if any
        if (req.files) {
            if (req.files['voice_note']) {
                const file = req.files['voice_note'][0];
                updates.voice_note_url = await uploadToDrive(file.buffer, file.originalname, file.mimetype);
            }
            if (req.files['reference_docs']) {
                const docs = await Promise.all(req.files['reference_docs'].map(async (f) => {
                    return await uploadToDrive(f.buffer, f.originalname, f.mimetype);
                }));
                updates.reference_docs = [...(existingTask.referenceDocs || []), ...docs.filter(u => u !== null)];
            }
            if (req.files['evidence_files']) {
                const docs = await Promise.all(req.files['evidence_files'].map(async (f) => {
                    return await uploadToDrive(f.buffer, f.originalname, f.mimetype);
                }));
                updates.evidence_url = docs[0]; // Assuming single evidence for now or update schema
            }
        }

        // Tracking history if status or due date changes
        if ((updates.status && updates.status !== existingTask.status) || (updates.dueDate && updates.dueDate !== existingTask.dueDate)) {
            await db.pool.query(
                `INSERT INTO task_revision_history (task_id, old_due_date, new_due_date, old_status, new_status, reason, changed_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [id, existingTask.dueDate, updates.dueDate || existingTask.dueDate, existingTask.status, updates.status || existingTask.status, updates.reason || 'Manual update', userName]
            );
            
            if (updates.status && updates.status !== existingTask.status) {
                updates.revision_count = (existingTask.revisionCount || 0) + 1;
                if (updates.status.toLowerCase() === 'completed') {
                    updates.completed_at = new Date();
                    const userRole = req.user.role || req.header('role');
                    if (userRole !== 'Admin' && userRole !== 'SuperAdmin') {
                        updates.approval_status = 'PENDING';
                    } else {
                        updates.approval_status = 'APPROVED';
                    }
                }
            }
        }

        // Map frontend field names to backend if necessary
        const backendUpdates = {};
        if (updates.taskTitle) backendUpdates.task_title = updates.taskTitle;
        if (updates.description) backendUpdates.description = updates.description;
        if (updates.status) backendUpdates.status = updates.status;
        if (updates.priority) backendUpdates.priority = updates.priority;
        if (updates.dueDate) backendUpdates.due_date = updates.dueDate;
        if (updates.category) backendUpdates.category = updates.category;
        
        // Handle JSON fields safely
        const safeParse = (str, fallback) => {
            if (!str || str === 'undefined' || str === 'null' || str === '') return fallback;
            try { return typeof str === 'string' ? JSON.parse(str) : str; } catch (e) { return fallback; }
        };

        if (updates.tags) backendUpdates.tags = JSON.stringify(safeParse(updates.tags, []));
        if (updates.checklistItems || updates.checklist) {
            const checklist = safeParse(updates.checklistItems || updates.checklist, []);
            backendUpdates.checklist = JSON.stringify(checklist);
        }
        if (updates.repeatSettings || updates.repeat_settings) {
            backendUpdates.repeat_settings = JSON.stringify(safeParse(updates.repeatSettings || updates.repeat_settings, {}));
        }
        if (updates.inLoopIds || updates.in_loop_ids) {
            backendUpdates.in_loop_ids = safeParse(updates.inLoopIds || updates.in_loop_ids, []);
        }

        if (updates.groupId || updates.group_id) backendUpdates.group_id = updates.groupId || updates.group_id;
        if (updates.parentId || updates.parent_id) backendUpdates.parent_id = updates.parentId || updates.parent_id;
        
        if (updates.voice_note_url) backendUpdates.voice_note_url = updates.voice_note_url;
        if (updates.reference_docs) backendUpdates.reference_docs = updates.reference_docs;
        if (updates.evidence_url) backendUpdates.evidence_url = updates.evidence_url;
        if (updates.completed_at) backendUpdates.completed_at = updates.completed_at;
        if (updates.revision_count !== undefined) backendUpdates.revision_count = updates.revision_count;
        if (updates.approval_status) backendUpdates.approval_status = updates.approval_status;

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            
            const updatedTask = await Task.update(id, backendUpdates, client);

            // Handle Reminders Update
            if (updates.reminders) {
                const final_reminders = safeParse(updates.reminders, []);
                await client.query('DELETE FROM task_reminders WHERE task_id = $1', [id]);
                
                for (const r of final_reminders) {
                    const rTime = calculateReminderTime(backendUpdates.due_date || existingTask.dueDate, r.timeValue, r.timeUnit, r.triggerType);
                    if (rTime) {
                        await client.query(
                            'INSERT INTO task_reminders (task_id, type, time_value, time_unit, trigger_type, reminder_time) VALUES ($1, $2, $3, $4, $5, $6)',
                            [id, r.type, r.timeValue, r.timeUnit, r.triggerType, rTime]
                        );
                    }
                }
            }

            await client.query('COMMIT');

            // Trigger notification
            await notifyUser('TASK_UPDATED', {
                ...updatedTask,
                triggeredById: userId,
                changedBy: userName
            });

            res.status(200).json({ success: true, data: updatedTask });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error in updateTask:', err);
        return res.status(500).json({ success: false, message: 'Error updating task' });
    }
};

// 10. Add Task Remark
exports.addTaskRemark = async (req, res) => {
    const { id } = req.params;
    const { remark } = req.body;
    const userId = req.user.id || req.user.User_Id;
    const userName = req.user.name || 'User';

    try {
        const task = await Task.findById(id);
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }
        
        const newRemark = await Task.addRemark(id, userId, userName, remark);

        // Trigger notification
        await notifyUser('TASK_REMARK_ADDED', {
            ...task,
            remark: remark,
            triggeredById: userId,
            changedBy: userName
        });

        res.status(201).json({ success: true, data: newRemark });
    } catch (err) {
        console.error('Error in addTaskRemark:', err);
        return res.status(500).json({ success: false, message: 'Error adding remark' });
    }
};

// -------------------------
// APPROVAL WORKFLOW
// -------------------------

exports.getPendingApprovals = async (req, res) => {
    try {
        const tasks = await Task.getApprovalsByStatus('PENDING');
        res.status(200).json({ success: true, data: tasks });
    } catch (err) {
        console.error('Error fetching pending approvals:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getApprovedTasks = async (req, res) => {
    try {
        const tasks = await Task.getApprovalsByStatus('APPROVED');
        res.status(200).json({ success: true, data: tasks });
    } catch (err) {
        console.error('Error fetching approved tasks:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getRejectedTasks = async (req, res) => {
    try {
        const tasks = await Task.getApprovalsByStatus('REJECTED');
        res.status(200).json({ success: true, data: tasks });
    } catch (err) {
        console.error('Error fetching rejected tasks:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.approveTask = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id || req.user.User_Id;

    try {
        // Fetch actual user name from DB since token might not have it
        const userResult = await db.query('SELECT first_name, last_name FROM employees WHERE user_id = $1', [userId]);
        const userName = userResult.rows.length > 0 ? `${userResult.rows[0].first_name} ${userResult.rows[0].last_name}` : 'Admin';

        const updatedTask = await Task.updateApprovalStatus(id, 'APPROVED', userName);
        if (!updatedTask) {
            return res.status(404).json({ success: false, message: 'Task not found' });
        }

        // Fetch full task details for rich notification payload
        const fullTask = await Task.findById(id);

        // Notify Doer
        await notifyUser('TASK_APPROVED', {
            ...fullTask,
            triggeredById: userId,
            changedBy: userName
        });

        res.status(200).json({ success: true, data: updatedTask, message: 'Task approved successfully' });
    } catch (err) {
        console.error('Error approving task:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.rejectTask = async (req, res) => {
    const { id } = req.params;
    const { remark } = req.body;
    const userId = req.user.id || req.user.User_Id;

    try {
        // Fetch actual user name from DB since token might not have it
        const userResult = await db.query('SELECT first_name, last_name FROM employees WHERE user_id = $1', [userId]);
        const userName = userResult.rows.length > 0 ? `${userResult.rows[0].first_name} ${userResult.rows[0].last_name}` : 'Admin';

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            
            const updatedTask = await Task.updateApprovalStatus(id, 'REJECTED', userName, client);
            
            // Add comment/remark if provided
            if (remark) {
                await Task.addRemark(id, userId, userName, remark, client);
            }
            
            // Optionally reset status to Pending or leave it as COMPLETED but REJECTED
            // We'll revert status to 'Pending' so the employee has to work on it again.
            await Task.update(id, { status: 'Pending' }, client);

            await client.query('COMMIT');

            // Fetch full task details for rich notification payload
            const fullTask = await Task.findById(id);

            // Notify Doer
            await notifyUser('TASK_REJECTED', {
                ...fullTask,
                status: 'Pending',
                triggeredById: userId,
                changedBy: userName,
                remark
            });

            res.status(200).json({ success: true, data: { ...updatedTask, status: 'Pending' }, message: 'Task rejected' });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error rejecting task:', err);
        res.status(500).json({ success: false, message: 'Server error' });
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
                        'INSERT INTO task_reminders (task_id, type, time_value, time_unit, trigger_type, reminder_time) VALUES ($1, $2, $3, $4, $5, $6)',
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
