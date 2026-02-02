const { pool } = require('../config/db.config');

const createAdvanceTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS advance_applications (
            id SERIAL PRIMARY KEY,

            user_id INTEGER NOT NULL,
            department VARCHAR(100),

            required_amount NUMERIC(10,2) NOT NULL,
            reason TEXT NOT NULL,

            date_needed DATE NOT NULL,
            repayment_period INTEGER NOT NULL, -- in months

            status VARCHAR(30) DEFAULT 'Pending', 
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT fk_advance_user
                FOREIGN KEY (user_id)
                REFERENCES employees(user_id)
                ON DELETE CASCADE
        );
    `;

    await pool.query(query);
    console.log('Advance applications table ready');
};

module.exports = { createAdvanceTable };
