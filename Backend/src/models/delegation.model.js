const { pool } = require('../config/db.config');

const createDelegationTables = async () => {
    const delegationQuery = `
    CREATE TABLE IF NOT EXISTS delegation (
        id SERIAL PRIMARY KEY,
        delegation_name VARCHAR(255) NOT NULL,
        description TEXT,
        delegator_id INTEGER,
        delegator_name VARCHAR(255),
        doer_id INTEGER,
        doer_name VARCHAR(255),
        department VARCHAR(100),
        priority VARCHAR(50) CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent', 'low', 'medium', 'high', 'urgent')),
        category VARCHAR(100),
        tags JSONB DEFAULT '[]',
        checklist JSONB DEFAULT '[]',
        status VARCHAR(50) CHECK (status IN ('Pending', 'pending', 'NEED CLARITY', 'need clarity', 'APPROVAL WAITING', 'approval waiting', 'COMPLETED', 'Completed', 'completed', 'NEED REVISION', 'need revision', 'HOLD', 'Hold', 'hold', 'In Progress', 'in progress', 'Overdue', 'overdue')) DEFAULT 'Pending',
        due_date TIMESTAMPTZ NOT NULL,
        voice_note_url TEXT,
        reference_docs TEXT[],
        evidence_url TEXT,
        evidence_required BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMPTZ,
        remarks TEXT[] DEFAULT '{}',
        revision_history JSONB[] DEFAULT '{}',
        revision_count INTEGER DEFAULT 0,
        deleted_at TIMESTAMPTZ,
        deleted_by VARCHAR(255),
        subscribed_by INTEGER[] DEFAULT '{}',
        in_loop_ids INTEGER[] DEFAULT '{}',
        group_id INTEGER,
        parent_id INTEGER REFERENCES delegation(id) ON DELETE CASCADE
    );
    `;

    const remarkQuery = `
    CREATE TABLE IF NOT EXISTS delegation_remarks (
        id SERIAL PRIMARY KEY,
        delegation_id INTEGER REFERENCES delegation(id) ON DELETE CASCADE,
        user_id INTEGER,
        username VARCHAR(100),
        remark TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `;

    const revisionHistoryQuery = `
    CREATE TABLE IF NOT EXISTS delegation_revision_history (
        id SERIAL PRIMARY KEY,
        delegation_id INTEGER REFERENCES delegation(id) ON DELETE CASCADE,
        old_due_date TIMESTAMPTZ,
        new_due_date TIMESTAMPTZ,
        old_status VARCHAR(50),
        new_status VARCHAR(50),
        reason TEXT,
        changed_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `;

    try {
        await pool.query(delegationQuery);
        await pool.query(remarkQuery);
        await pool.query(revisionHistoryQuery);
        
        // Ensure new columns exist for existing tables
        await pool.query(`ALTER TABLE delegation ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`);
        await pool.query(`ALTER TABLE delegation ADD COLUMN IF NOT EXISTS revision_count INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE delegation ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
        await pool.query(`ALTER TABLE delegation ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255)`);
        await pool.query(`ALTER TABLE delegation ADD COLUMN IF NOT EXISTS subscribed_by INTEGER[] DEFAULT '{}'`);
        await pool.query(`ALTER TABLE delegation ADD COLUMN IF NOT EXISTS category VARCHAR(100)`);
        await pool.query(`ALTER TABLE delegation ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'`);
        await pool.query(`ALTER TABLE delegation ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'`);
        await pool.query(`ALTER TABLE delegation ADD COLUMN IF NOT EXISTS evidence_url TEXT`);
        await pool.query(`ALTER TABLE delegation ADD COLUMN IF NOT EXISTS repeat_settings JSONB DEFAULT '{}'`);
        await pool.query(`ALTER TABLE delegation ADD COLUMN IF NOT EXISTS in_loop_ids INTEGER[] DEFAULT '{}'`);
        await pool.query(`ALTER TABLE delegation ADD COLUMN IF NOT EXISTS group_id INTEGER`);
        await pool.query(`ALTER TABLE delegation ADD COLUMN IF NOT EXISTS parent_id INTEGER`);
        // record_source column is now legacy and has been removed via migration
        
        // Update CHECK constraints for existing tables
        try {
            // Drop old constraints if they exist
            await pool.query(`ALTER TABLE delegation DROP CONSTRAINT IF EXISTS delegation_priority_check`);
            await pool.query(`ALTER TABLE delegation DROP CONSTRAINT IF EXISTS delegation_status_check`);
            
            // Re-add updated constraints
            await pool.query(`ALTER TABLE delegation ADD CONSTRAINT delegation_priority_check CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent', 'low', 'medium', 'high', 'urgent'))`);
            await pool.query(`ALTER TABLE delegation ADD CONSTRAINT delegation_status_check CHECK (status IN ('Pending', 'pending', 'NEED CLARITY', 'need clarity', 'APPROVAL WAITING', 'approval waiting', 'COMPLETED', 'Completed', 'completed', 'NEED REVISION', 'need revision', 'HOLD', 'Hold', 'hold', 'In Progress', 'in progress', 'Overdue', 'overdue'))`);
        } catch (e) {
            console.log('Constraints already updated or could not be updated:', e.message);
        }
        
        console.log('Delegation tables ensured in database');
    } catch (err) {
        console.error('Error creating delegation tables:', err);
        throw err;
    }
};

module.exports = {
    createDelegationTables,
};
