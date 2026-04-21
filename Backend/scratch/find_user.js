const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function findUser() {
    try {
        const res = await pool.query(`
            SELECT user_id, first_name, last_name, work_email 
            FROM employees 
            WHERE first_name ILIKE '%test%' OR last_name ILIKE '%doe%'
        `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

findUser();
