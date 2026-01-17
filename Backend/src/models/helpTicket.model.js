const { pool } = require('../config/db.config');

const createHelpTicketTables = async () => {
    const ticketTableQuery = `
    CREATE TABLE IF NOT EXISTS help_tickets (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        help_ticket_no VARCHAR(50) UNIQUE NOT NULL,
        location VARCHAR(255),
        raised_by INTEGER REFERENCES employees(user_id),
        pc_accountable INTEGER REFERENCES employees(user_id),
        issue_description TEXT,
        problem_solver INTEGER REFERENCES employees(user_id),
        desired_date TIMESTAMPTZ,
        image_upload TEXT,
        priority VARCHAR(20) DEFAULT 'medium',
        current_stage INTEGER DEFAULT 1,
        status VARCHAR(50) DEFAULT 'OPEN',

        -- Stage 2: PC Planning
        pc_planned_date TIMESTAMPTZ,
        pc_actual_date TIMESTAMPTZ,
        pc_status VARCHAR(50),
        pc_remark TEXT,
        pc_time_difference INTERVAL,

        -- Stage 3: Solver
        solver_planned_date TIMESTAMPTZ,
        solver_actual_date TIMESTAMPTZ,
        revise_count INTEGER DEFAULT 0,
        proof_upload TEXT,
        solver_remark TEXT,
        solver_time_difference INTERVAL,

        -- Stage 4: PC Confirmation
        pc_planned_stage4 TIMESTAMPTZ,
        pc_actual_stage4 TIMESTAMPTZ,
        pc_status_stage4 VARCHAR(50),
        pc_remark_stage4 TEXT,
        pc_time_difference_stage4 INTERVAL,

        -- Stage 5: Closure
        closing_planned TIMESTAMPTZ,
        closing_actual TIMESTAMPTZ,
        closing_status VARCHAR(50),
        closing_rating INTEGER,
        reraise_date TIMESTAMPTZ,
        closing_time_difference INTERVAL,
        
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    `;

    const historyTableQuery = `
    CREATE TABLE IF NOT EXISTS help_ticket_history (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER REFERENCES help_tickets(id) ON DELETE CASCADE,
        ticket_no VARCHAR(50),
        stage INTEGER,
        old_values JSONB,
        new_values JSONB,
        action_type VARCHAR(50), -- REVISE, RERAISE, STAGE_CHANGE
        action_by INTEGER REFERENCES employees(user_id),
        action_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        remarks TEXT
    );
    `;

    try {
        await pool.query(ticketTableQuery);
        await pool.query(historyTableQuery);
        console.log('Help Ticket tables ensured in database');
    } catch (err) {
        console.error('Error creating help ticket tables:', err);
        throw err;
    }
};

module.exports = {
    createHelpTicketTables,
};
