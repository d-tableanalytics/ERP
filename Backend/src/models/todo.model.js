const { pool } = require('../config/db.config');

const createTodoTables = async () => {
    const queries = [
        `CREATE TABLE IF NOT EXISTS todos (
            todo_id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            priority VARCHAR(50) DEFAULT 'Normal',
            status VARCHAR(50) DEFAULT 'To Do',
            due_date TIMESTAMPTZ,
            created_by INTEGER REFERENCES employees(User_Id),
            assigned_to INTEGER REFERENCES employees(User_Id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`
    ];

    try {
        for (const queryText of queries) {
            await pool.query(queryText);
        }
        console.log('Kanban ToDo table ensured in database');
    } catch (err) {
        console.error('Error creating ToDo tables:', err);
        throw err;
    }
};

module.exports = {
    createTodoTables,
};
