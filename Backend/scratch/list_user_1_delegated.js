const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function listUser1Delegated() {
    try {
        const res = await pool.query(`
            SELECT id, delegation_name, doer_id, doer_name 
            FROM delegation 
            WHERE delegator_id = 1
            ORDER BY created_at DESC
        `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

listUser1Delegated();
