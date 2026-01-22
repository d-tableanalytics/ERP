const { pool } = require('../config/db.config');

const createHelpTicketConfigTable = async () => {
    const configTableQuery = `
    CREATE TABLE IF NOT EXISTS help_ticket_config (
        id SERIAL PRIMARY KEY,
        stage2_tat_hours INTEGER DEFAULT 24,
        stage4_tat_hours INTEGER DEFAULT 4,
        stage5_tat_hours INTEGER DEFAULT 24,
        office_start_time TIME DEFAULT '09:00:00',
        office_end_time TIME DEFAULT '18:00:00',
        working_days JSONB DEFAULT '[1, 2, 3, 4, 5, 6]', -- 1=Mon, 7=Sun
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    `;

    const holidaysTableQuery = `
    CREATE TABLE IF NOT EXISTS help_ticket_holidays (
        id SERIAL PRIMARY KEY,
        holiday_date DATE UNIQUE NOT NULL,
        description VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    `;

    // Function to ensure default config exists
    const seedConfigQuery = `
    INSERT INTO help_ticket_config (id, stage2_tat_hours, stage4_tat_hours, stage5_tat_hours)
    SELECT 1, 24, 4, 24
    WHERE NOT EXISTS (SELECT 1 FROM help_ticket_config WHERE id = 1);
    `;

    try {
        await pool.query(configTableQuery);
        await pool.query(holidaysTableQuery);
        await pool.query(seedConfigQuery);
        console.log('Help Ticket Config & Holidays tables ensured in database');
    } catch (err) {
        console.error('Error creating help ticket config tables:', err);
        throw err;
    }
};

module.exports = {
    createHelpTicketConfigTable,
};
