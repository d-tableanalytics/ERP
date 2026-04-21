const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function listTasks() {
    try {
        const res = await pool.query(`
            SELECT id, delegation_name, delegator_id, doer_id, status 
            FROM delegation 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        console.log('Recent Tasks:');
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

listTasks();
