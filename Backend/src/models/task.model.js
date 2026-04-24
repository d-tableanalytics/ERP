const { pool } = require('../config/db.config');

const createTaskTable = async () => {
    // Table is now created via migration script
    console.log('Task table and schema enhancements ensured via migration');
};

class Task {
    static get BASE_QUERY() {
        return `
            SELECT 
                t.id, 
                t.task_title AS "taskTitle", 
                t.description, 
                t.delegator_id AS "assignerId", 
                t.delegator_name AS "assignerName",
                t.doer_id AS "doerId", 
                t.doer_name AS "doerName", 
                e_doer.first_name AS "doerFirstName",
                e_doer.last_name AS "doerLastName",
                e_del.first_name AS "assignerFirstName",
                e_del.last_name AS "assignerLastName",
                t.department, 
                t.priority, 
                t.due_date AS "dueDate", 
                t.status, 
                t.category, 
                t.tags, 
                t.checklist AS "checklistItems", 
                t.repeat_settings AS "repeatSettings",
                t.in_loop_ids AS "inLoopIds",
                t.group_id AS "groupId",
                t.parent_id AS "parentId",
                t.voice_note_url AS "voiceNoteUrl",
                t.reference_docs AS "referenceDocs",
                t.evidence_url AS "evidenceUrl",
                t.evidence_required AS "evidenceRequired",
                t.created_at AS "createdAt",
                t.completed_at AS "completedAt",
                t.remarks,
                t.revision_count AS "revisionCount"
            FROM tasks t
            LEFT JOIN employees e_doer ON t.doer_id = e_doer.user_id
            LEFT JOIN employees e_del ON t.delegator_id = e_del.user_id
        `;
    }

    static async create(data, client = pool) {
        const query = `
            INSERT INTO tasks (
                task_title, description, delegator_id, delegator_name,
                doer_id, doer_name, department, priority, due_date, 
                voice_note_url, reference_docs, evidence_required,
                status, category, tags, checklist, repeat_settings,
                in_loop_ids, group_id, parent_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) 
            RETURNING *`;

        const values = [
            data.task_title || data.delegation_name,
            data.description,
            data.delegator_id,
            data.delegator_name,
            data.doer_id,
            data.doer_name,
            data.department,
            data.priority,
            data.due_date,
            data.voice_note_url,
            data.reference_docs,
            data.evidence_required,
            data.status || 'Pending',
            data.category || 'Category',
            JSON.stringify(data.tags || []),
            JSON.stringify(data.checklist || []),
            JSON.stringify(data.repeat_settings || {}),
            data.in_loop_ids || [],
            data.group_id || null,
            data.parent_id || null
        ];

        const result = await client.query(query, values);
        return result.rows[0];
    }

    static async findById(id) {
        const query = `${this.BASE_QUERY} WHERE t.id = $1`;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    static async findAll(filters = {}, userId = null) {
        let query = `${this.BASE_QUERY} WHERE t.deleted_at IS NULL`;
        const values = [];

        if (filters.status) {
            values.push(filters.status);
            query += ` AND t.status = $${values.length}`;
        }

        if (userId) {
            values.push(userId);
            const idx = values.length;
            query += ` AND (t.doer_id = $${idx} OR t.delegator_id = $${idx} OR $${idx} = ANY(t.in_loop_ids) OR $${idx} = ANY(t.subscribed_by))`;
        }

        query += " ORDER BY t.created_at DESC";
        const result = await pool.query(query, values);
        return result.rows;
    }

    static async findMyTasks(userId) {
        const query = `${this.BASE_QUERY} WHERE t.doer_id = $1 AND t.deleted_at IS NULL ORDER BY t.created_at DESC`;
        const result = await pool.query(query, [userId]);
        return result.rows;
    }

    static async findDelegatedTasks(userId) {
        const query = `${this.BASE_QUERY} WHERE t.delegator_id = $1 AND t.doer_id != $1 AND t.deleted_at IS NULL ORDER BY t.created_at DESC`;
        const result = await pool.query(query, [userId]);
        return result.rows;
    }

    static async findSubscribedTasks(userId) {
        const query = `${this.BASE_QUERY} WHERE ($1 = ANY(t.subscribed_by) OR $1 = ANY(t.in_loop_ids)) AND t.deleted_at IS NULL ORDER BY t.created_at DESC`;
        const result = await pool.query(query, [userId]);
        return result.rows;
    }

    static async findDeletedTasks() {
        const query = `${this.BASE_QUERY} WHERE t.deleted_at IS NOT NULL ORDER BY t.deleted_at DESC`;
        const result = await pool.query(query);
        return result.rows;
    }

    static async update(id, updates, client = pool) {
        const fields = [];
        const values = [];
        let i = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined) {
                fields.push(`${key} = $${i++}`);
                values.push(value);
            }
        }

        if (fields.length === 0) return null;

        values.push(id);
        const query = `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`;
        const result = await client.query(query, values);
        return result.rows[0];
    }

    static async softDelete(id, deletedBy) {
        const query = "UPDATE tasks SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2 RETURNING *";
        const result = await pool.query(query, [deletedBy, id]);
        return result.rows[0];
    }

    static async restore(id) {
        const query = "UPDATE tasks SET deleted_at = NULL, deleted_by = NULL WHERE id = $1 RETURNING *";
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    static async addRemark(taskId, userId, username, remark, client = pool) {
        const remarkQuery = "INSERT INTO task_remarks (task_id, user_id, username, remark) VALUES ($1, $2, $3, $4) RETURNING *";
        const result = await client.query(remarkQuery, [taskId, userId, username, remark]);
        
        await client.query(
            "UPDATE tasks SET remarks = array_append(remarks, $1) WHERE id = $2",
            [remark, taskId]
        );
        
        return result.rows[0];
    }

    static async subscribe(id, userId) {
        const query = "UPDATE tasks SET subscribed_by = array_append(subscribed_by, $1) WHERE id = $2 AND NOT ($1 = ANY(subscribed_by)) RETURNING *";
        const result = await pool.query(query, [userId, id]);
        return result.rows[0];
    }

    static async getRemarks(taskId) {
        const query = "SELECT * FROM task_remarks WHERE task_id = $1 ORDER BY created_at ASC";
        const result = await pool.query(query, [taskId]);
        return result.rows;
    }

    static async getRevisionHistory(taskId) {
        const query = "SELECT * FROM task_revision_history WHERE task_id = $1 ORDER BY created_at DESC";
        const result = await pool.query(query, [taskId]);
        return result.rows;
    }

    static async getSubtasks(parentId) {
        const query = `${this.BASE_QUERY} WHERE t.parent_id = $1 AND t.deleted_at IS NULL ORDER BY t.created_at ASC`;
        const result = await pool.query(query, [parentId]);
        return result.rows;
    }
}

module.exports = {
    createTaskTable,
    Task
};

