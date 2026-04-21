const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function findAashu() {
    try {
        const res = await pool.query(`
            SELECT user_id, first_name, last_name, work_email 
            FROM employees 
            WHERE first_name ILIKE '%aashu%' OR last_name ILIKE '%yadav%'
        `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

findAashu();
