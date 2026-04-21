const db = require('../config/db.config');
const { uploadToDrive } = require('../utils/googleDrive');
const { createNotification } = require('../utils/notification');

// Helper to calculate reminder time
const calculateReminderTime = (dueDate, timeValue, timeUnit, triggerType) => {
    if (!dueDate) return null;
    let date = new Date(dueDate);
    if (isNaN(date.getTime())) return null;

    let ms = 0;
    const value = parseInt(timeValue);
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

const BASE_SELECT = `
    SELECT 
        d.id, 
        d.delegation_name AS "taskTitle", 
        d.description, 
        d.delegator_id AS "delegatorId", 
        d.delegator_name AS "delegatorName",
        d.doer_id AS "doerId", 
        d.doer_name AS "doerName", 
        e_doer.first_name AS "doerFirstName",
        e_doer.last_name AS "doerLastName",
        e_del.first_name AS "delegatorFirstName",
        e_del.last_name AS "delegatorLastName",
        e_del.first_name AS "assignerFirstName",
        e_del.last_name AS "assignerLastName",
        d.department, 
        d.priority, 
        d.due_date AS "dueDate", 
        d.status, 
        d.category, 
        d.tags, 
        d.checklist AS "checklistItems", 
        d.repeat_settings AS "repeatSettings",
        d.in_loop_ids AS "inLoopIds",
        d.group_id AS "groupId",
        d.parent_id AS "parentId",
        d.voice_note_url AS "voiceNoteUrl",
        d.reference_docs AS "referenceDocs",
        d.evidence_required AS "evidenceRequired",
        d.created_at AS "createdAt"
    FROM delegation d
    LEFT JOIN employees e_doer ON d.doer_id = e_doer.user_id
    LEFT JOIN employees e_del ON d.delegator_id = e_del.user_id
`;

// 1. My Tasks - Tasks assigned to the current user (Doer)
exports.getMyTasks = async (req, res) => {
    const userId = req.user.id || req.user.User_Id;
    try {
        const query = `
            ${BASE_SELECT}
            WHERE d.doer_id = $1 AND d.deleted_at IS NULL 
            ORDER BY d.created_at DESC
        `;
        console.log('Fetching My Tasks for userId:', userId);
        const result = await db.query(query, [userId]);
        console.log(`Found ${result.rows.length} tasks for user ${userId}`);
        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
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
        const query = `
            ${BASE_SELECT}
            WHERE d.delegator_id = $1 AND d.doer_id != $1 AND d.deleted_at IS NULL 
            ORDER BY d.created_at DESC
        `;
        console.log('Fetching Delegated Tasks for userId:', userId);
        const result = await db.query(query, [userId]);
        console.log(`Found ${result.rows.length} delegated tasks for user ${userId}`);
        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
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
        const query = `
            ${BASE_SELECT}
            WHERE ($1 = ANY(d.subscribed_by) OR $1 = ANY(d.in_loop_ids)) 
            AND d.deleted_at IS NULL 
            ORDER BY d.created_at DESC
        `;
        const result = await db.query(query, [userId]);
        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
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
        let query, values = [];
        const baseSelect = `
            SELECT 
                d.id, 
                d.delegation_name AS "taskTitle", 
                d.description, 
                d.delegator_id AS "delegatorId", 
                d.delegator_name AS "delegatorName",
                d.doer_id AS "doerId", 
                d.doer_name AS "doerName", 
                e_doer.first_name AS "doerFirstName",
                e_doer.last_name AS "doerLastName",
                e_del.first_name AS "delegatorFirstName",
                e_del.last_name AS "delegatorLastName",
                d.department, 
                d.priority, 
                d.due_date AS "dueDate", 
                d.status, 
                d.category, 
                d.tags, 
                d.checklist AS "checklistItems", 
                d.repeat_settings AS "repeatSettings",
                d.in_loop_ids AS "inLoopIds",
                d.group_id AS "groupId",
                d.parent_id AS "parentId",
                d.voice_note_url AS "voiceNoteUrl",
                d.reference_docs AS "referenceDocs",
                d.evidence_required AS "evidenceRequired",
                d.created_at AS "createdAt"
            FROM delegation d
            LEFT JOIN employees e_doer ON d.doer_id = e_doer.user_id
            LEFT JOIN employees e_del ON d.delegator_id = e_del.user_id
        `;

        const userRole = role?.toLowerCase();
        if (userRole === 'admin' || userRole === 'superadmin') {
            query = `${BASE_SELECT} WHERE d.deleted_at IS NULL ORDER BY d.created_at DESC`;
        } else {
            query = `
                ${BASE_SELECT}
                WHERE d.deleted_at IS NULL AND (
                    d.doer_id = $1 OR 
                    d.delegator_id = $1 OR 
                    $1 = ANY(d.in_loop_ids) OR 
                    $1 = ANY(d.subscribed_by)
                ) 
                ORDER BY d.created_at DESC
            `;
            values = [userId];
        }
        const result = await db.query(query, values);
        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (err) {
        console.error('Error in getAllTasks:', err);
        res.status(500).json({ success: false, message: 'Error fetching all tasks' });
    }
};

// 5. Deleted Tasks - Tasks that have been soft deleted
exports.getDeletedTasks = async (req, res) => {
    const userId = req.user.id || req.user.User_Id;
    const { role } = req.user;
    try {
        let query, values = [];
        const userRole = role?.toLowerCase();
        const baseSelectWithDeletedAt = BASE_SELECT.replace('d.created_at AS "createdAt"', 'd.created_at AS "createdAt", d.deleted_at AS "deletedAt"');

        if (userRole === 'admin' || userRole === 'superadmin') {
            query = `${baseSelectWithDeletedAt} WHERE d.deleted_at IS NOT NULL ORDER BY d.deleted_at DESC`;
        } else {
            query = `
                ${baseSelectWithDeletedAt}
                WHERE d.deleted_at IS NOT NULL AND (
                    d.doer_id = $1 OR 
                    d.delegator_id = $1
                ) 
                ORDER BY d.deleted_at DESC
            `;
            values = [userId];
        }
        const result = await db.query(query, values);
        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });
    } catch (err) {
        console.error('Error in getDeletedTasks:', err);
        res.status(500).json({ success: false, message: 'Error fetching deleted tasks' });
    }
};

// 6. Create Task
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
        isRepeat,
        repeatSettings, repeat_settings,
        inLoopIds, in_loop_ids,
        groupId, group_id,
        parentId, parent_id,
        reminders
    } = req.body;

    const final_name = taskTitle || delegation_name;
    const final_delegator_id = parseInt(assignerId || delegator_id || req.user.id);
    const final_assigner_name = assignerName || delegator_name || req.user.name || 'User';

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
            reference_docs = await Promise.all(req.files['reference_docs'].map(async (f) => {
                return await uploadToDrive(f.buffer, f.originalname, f.mimetype);
            }));
            reference_docs = reference_docs.filter(u => u !== null);
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

            const query = `
                INSERT INTO delegation (
                    delegation_name, description, delegator_id, delegator_name,
                    doer_id, doer_name, department, priority, due_date, 
                    voice_note_url, reference_docs, evidence_required,
                    status, category, tags, checklist, repeat_settings,
                    in_loop_ids, group_id, parent_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING *`;

            const values = [
                final_name, description, final_delegator_id, final_assigner_name,
                targetDoerId, final_doer_name, department, priority, final_due_date,
                voice_note_url, reference_docs, final_evidence_req,
                'Pending', category || 'Category',
                JSON.stringify(final_tags),
                JSON.stringify(final_checklist || []),
                JSON.stringify(final_repeat),
                final_in_loop, // Pass as JS array for PG ARRAY column
                groupId || group_id ? parseInt(groupId || group_id) : null,
                parentId || parent_id ? parseInt(parentId || parent_id) : null
            ];

            const result = await client.query(query, values);
            results.push(result.rows[0]);

            // Reminders support
            if (final_reminders.length > 0) {
                for (const r of final_reminders) {
                    const rTime = calculateReminderTime(final_due_date, r.timeValue, r.timeUnit, r.triggerType);
                    await client.query(
                        'INSERT INTO task_reminders (delegation_id, type, time_value, time_unit, trigger_type, reminder_time) VALUES ($1, $2, $3, $4, $5, $6)',
                        [result.rows[0].id, r.type, r.timeValue, r.timeUnit, r.triggerType, rTime]
                    );
                }
            }

            // Notification
            if (targetDoerId !== final_delegator_id) {
                await createNotification(
                    targetDoerId,
                    'TASK_ASSIGNED',
                    `New task assigned: ${final_name}`,
                    `/delegation/${result.rows[0].id}`,
                    final_delegator_id
                );
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ success: true, data: results });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('Error creating task. Full stack:', err.stack);
        console.error('Request Body:', req.body);
        res.status(500).json({ 
            success: false, 
            message: 'Error creating task',
            error: err.message
        });
    } finally { 
        if (client) client.release(); 
    }
};
