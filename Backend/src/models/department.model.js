const { pool } = require('../config/db.config');

const createDepartmentTable = async () => {
    const queryText = `
    CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
    try {
        await pool.query(queryText);
        console.log('Departments table ensured in database');

        // Seed initial departments if none exist
        const checkQuery = 'SELECT COUNT(*) FROM departments';
        const { rows } = await pool.query(checkQuery);

        if (parseInt(rows[0].count) === 0) {
            const seedQuery = `
                INSERT INTO departments (name) VALUES 
                ('HR'), ('IT'), ('Finance'), ('Sales'), 
                ('Operations'), ('Customer Service'), ('Custom')
                ON CONFLICT (name) DO NOTHING;
            `;
            await pool.query(seedQuery);
            console.log('Seed departments added');
        }
    } catch (err) {
        console.error('Error creating departments table:', err);
        throw err;
    }
};

module.exports = {
    createDepartmentTable,
};
