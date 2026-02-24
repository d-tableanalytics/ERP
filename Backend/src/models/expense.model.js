const { pool } = require('../config/db.config');

const createExpenseMasterTable = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS expense_master (
            id SERIAL PRIMARY KEY,

            user_id INTEGER NOT NULL,
         
            location VARCHAR(100),
            client VARCHAR(100),
            company VARCHAR(150),
            bill_pay_pdf TEXT[],
            rejection_reason TEXT,
            approved_by INTEGER,
            advance NUMERIC(10,2) DEFAULT 0,
            total NUMERIC(10,2) DEFAULT 0,
            net NUMERIC(10,2) DEFAULT 0,

            status VARCHAR(50) DEFAULT 'Pending',

            start_date DATE NOT NULL,
            end_date DATE NOT NULL,

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT fk_expense_user
                FOREIGN KEY (user_id)
                REFERENCES employees(user_id)
                ON DELETE CASCADE
        );
    `;

    try {
        await pool.query(queryText);
        console.log('Expense Master table ensured in database');
    } catch (err) {
        console.error('Error creating expense_master table:', err);
        throw err;
    }
};

const createExpenseDaysTable = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS expense_days (
            id SERIAL PRIMARY KEY,

            expense_id INTEGER NOT NULL,

            day_no INTEGER NOT NULL, -- 1 = D1, 2 = D2, 3 = D3...
            description TEXT,
            amount NUMERIC(10,2) DEFAULT 0,
            pdf_url TEXT,

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            CONSTRAINT fk_expense_master
                FOREIGN KEY (expense_id)
                REFERENCES expense_master(id)
                ON DELETE CASCADE
        );
    `;

    try {
        await pool.query(queryText);
        console.log('Expense Days table ensured in database');
    } catch (err) {
        console.error('Error creating expense_days table:', err);
        throw err;
    }
};

module.exports = {
    createExpenseMasterTable, createExpenseDaysTable,
};
