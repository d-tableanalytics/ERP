const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkUser1() {
    try {
        const res = await pool.query(`
            SELECT count(*) FROM delegation WHERE doer_id = 1
        `);
        console.log('Tasks where user 1 is doer:', res.rows[0].count);
        
        const res2 = await pool.query(`
            SELECT count(*) FROM delegation WHERE delegator_id = 1
        `);
        console.log('Tasks where user 1 is delegator:', res2.rows[0].count);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkUser1();
