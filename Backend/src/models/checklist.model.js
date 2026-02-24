const { pool } = require('../config/db.config');

const createChecklistTables = async () => {
    const masterTableQuery = `
    CREATE TABLE IF NOT EXISTS checklist_master (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        assignee_id INTEGER REFERENCES employees(User_Id) ON DELETE SET NULL,
        doer_id INTEGER REFERENCES employees(User_Id) ON DELETE SET NULL,
        priority VARCHAR(20) CHECK (priority IN ('low', 'medium', 'high')),
        department VARCHAR(100),
        verification_required BOOLEAN DEFAULT false,
        verifier_id INTEGER REFERENCES employees(User_Id) ON DELETE SET NULL,
        attachment_required BOOLEAN DEFAULT false,
        frequency VARCHAR(20) CHECK (frequency IN ('daily', 'weekly', 'monthly', 'custom')),
        from_date DATE,
        due_date DATE,
        weekly_days TEXT[] DEFAULT '{}',
        selected_dates INTEGER[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `;

    const checklistTableQuery = `
    CREATE TABLE IF NOT EXISTS checklist (
        id SERIAL PRIMARY KEY,
        master_id INTEGER REFERENCES checklist_master(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        assignee_id INTEGER,
        assignee_name VARCHAR(255),
        doer_id INTEGER,
        doer_name VARCHAR(255),
        priority VARCHAR(20),
        department VARCHAR(100),
        verification_required BOOLEAN,
        verifier_id INTEGER,
        verifier_name VARCHAR(255),
        attachment_required BOOLEAN,
        frequency VARCHAR(20),
        status VARCHAR(50) DEFAULT \'Pending\' CHECK (status IN (\'Pending\', \'Completed\', \'In Progress\', \'Verified\', \'Hold\')),
        proof_file_url TEXT,
        due_date TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        revision_count INTEGER DEFAULT 0,
        created_at DATE DEFAULT CURRENT_DATE
    );
    `;

    try {
        await pool.query(masterTableQuery);
        await pool.query(checklistTableQuery);
        
        // Ensure new columns exist for existing tables
        await pool.query(`ALTER TABLE checklist ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`);
        await pool.query(`ALTER TABLE checklist ADD COLUMN IF NOT EXISTS revision_count INTEGER DEFAULT 0`);
        
        console.log('Checklist tables ensured in database');
    } catch (err) {
        console.error('Error creating checklist tables:', err);
        throw err;
    }
};

module.exports = {
    createChecklistTables,
};
