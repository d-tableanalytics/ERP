const { pool } = require('../config/db.config');

const createTaskTable = async () => {
    // Tasks share the delegation table but are identified by record_source = 'task'
    // This ensures the necessary columns exist
    const queries = [
        `ALTER TABLE delegation ADD COLUMN IF NOT EXISTS record_source VARCHAR(50) DEFAULT 'delegation'`,
        `ALTER TABLE delegation ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES delegation(id) ON DELETE CASCADE`,
        `CREATE INDEX IF NOT EXISTS idx_delegation_record_source ON delegation(record_source)`,
        `CREATE INDEX IF NOT EXISTS idx_delegation_parent_id ON delegation(parent_id)`
    ];

    try {
        for (const query of queries) {
            await pool.query(query);
        }
        console.log('Task specific schema enhancements ensured');
    } catch (err) {
        console.error('Error ensuring task schema:', err);
        // Don't throw, as the table might already have these or be handled by delegation.model.js
    }
};

class Task {
    static get BASE_QUERY() {
        return `
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
    }

    static async create(data, client = pool) {
        const query = `
            INSERT INTO delegation (
                delegation_name, description, delegator_id, delegator_name,
                doer_id, doer_name, department, priority, due_date, 
                voice_note_url, reference_docs, evidence_required,
                status, category, tags, checklist, repeat_settings,
                in_loop_ids, group_id, parent_id, record_source
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) 
            RETURNING *`;

        const values = [
            data.delegation_name,
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
            data.parent_id || null,
            'task'
        ];

        const result = await client.query(query, values);
        return result.rows[0];
    }

    static async findById(id) {
        const query = `${this.BASE_QUERY} WHERE d.id = $1 AND d.record_source = 'task'`;
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    static async findAll(filters = {}, userId = null) {
        let query = `${this.BASE_QUERY} WHERE d.record_source = 'task' AND d.deleted_at IS NULL`;
        const values = [];

        if (filters.status) {
            values.push(filters.status);
            query += ` AND d.status = $${values.length}`;
        }

        if (userId) {
            values.push(userId);
            const idx = values.length;
            query += ` AND (d.doer_id = $${idx} OR d.delegator_id = $${idx} OR $${idx} = ANY(d.in_loop_ids) OR $${idx} = ANY(d.subscribed_by))`;
        }

        query += " ORDER BY d.created_at DESC";
        const result = await pool.query(query, values);
        return result.rows;
    }

    static async findMyTasks(userId) {
        const query = `${this.BASE_QUERY} WHERE d.doer_id = $1 AND d.record_source = 'task' AND d.deleted_at IS NULL ORDER BY d.created_at DESC`;
        const result = await pool.query(query, [userId]);
        return result.rows;
    }

    static async findDelegatedTasks(userId) {
        const query = `${this.BASE_QUERY} WHERE d.delegator_id = $1 AND d.doer_id != $1 AND d.record_source = 'task' AND d.deleted_at IS NULL ORDER BY d.created_at DESC`;
        const result = await pool.query(query, [userId]);
        return result.rows;
    }

    static async findSubscribedTasks(userId) {
        const query = `${this.BASE_QUERY} WHERE ($1 = ANY(d.subscribed_by) OR $1 = ANY(d.in_loop_ids)) AND d.record_source = 'task' AND d.deleted_at IS NULL ORDER BY d.created_at DESC`;
        const result = await pool.query(query, [userId]);
        return result.rows;
    }

    static async findDeletedTasks() {
        const query = `${this.BASE_QUERY} WHERE d.record_source = 'task' AND d.deleted_at IS NOT NULL ORDER BY d.deleted_at DESC`;
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
        const query = `UPDATE delegation SET ${fields.join(', ')} WHERE id = $${i} AND record_source = 'task' RETURNING *`;
        const result = await client.query(query, values);
        return result.rows[0];
    }

    static async softDelete(id, deletedBy) {
        const query = "UPDATE delegation SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2 AND record_source = 'task' RETURNING *";
        const result = await pool.query(query, [deletedBy, id]);
        return result.rows[0];
    }

    static async restore(id) {
        const query = "UPDATE delegation SET deleted_at = NULL, deleted_by = NULL WHERE id = $1 AND record_source = 'task' RETURNING *";
        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    static async addRemark(taskId, userId, username, remark, client = pool) {
        const remarkQuery = "INSERT INTO remark (delegation_id, user_id, username, remark) VALUES ($1, $2, $3, $4) RETURNING *";
        const result = await client.query(remarkQuery, [taskId, userId, username, remark]);
        
        await client.query(
            "UPDATE delegation SET remarks = array_append(remarks, $1) WHERE id = $2",
            [remark, taskId]
        );
        
        return result.rows[0];
    }

    static async subscribe(id, userId) {
        const query = "UPDATE delegation SET subscribed_by = array_append(subscribed_by, $1) WHERE id = $2 AND record_source = 'task' AND NOT ($1 = ANY(subscribed_by)) RETURNING *";
        const result = await pool.query(query, [userId, id]);
        return result.rows[0];
    }
}

module.exports = {
    createTaskTable,
    Task
};
