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
        priority VARCHAR(50) CHECK (priority IN ('low', 'medium', 'high')),
        status VARCHAR(50) CHECK (status IN ('NEED CLARITY', 'APPROVAL WAITING', 'COMPLETED', 'NEED REVISION', 'HOLD')) DEFAULT 'NEED CLARITY',
        due_date TIMESTAMPTZ NOT NULL,
        voice_note_url TEXT,
        reference_docs TEXT[],
        evidence_required BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        remarks TEXT[] DEFAULT '{}',
        revision_history JSONB[] DEFAULT '{}'
    );
    `;

    const remarkQuery = `
    CREATE TABLE IF NOT EXISTS remark (
        id SERIAL PRIMARY KEY,
        delegation_id INTEGER REFERENCES delegation(id) ON DELETE CASCADE,
        user_id INTEGER,
        username VARCHAR(100),
        remark TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `;

    const revisionHistoryQuery = `
    CREATE TABLE IF NOT EXISTS revision_history (
        id SERIAL PRIMARY KEY,
        delegation_id INTEGER REFERENCES delegation(id) ON DELETE CASCADE,
        old_due_date DATE,
        new_due_date DATE,
        old_status VARCHAR(50),
        new_status VARCHAR(50),
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `;

    try {
        await pool.query(delegationQuery);
        await pool.query(remarkQuery);
        await pool.query(revisionHistoryQuery);
        console.log('Delegation tables ensured in database');
    } catch (err) {
        console.error('Error creating delegation tables:', err);
        throw err;
    }
};

module.exports = {
    createDelegationTables,
};
