const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function findAashuRole() {
    try {
        const res = await pool.query(`
            SELECT user_id, first_name, last_name, role 
            FROM employees 
            WHERE user_id = 1
        `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

findAashuRole();
