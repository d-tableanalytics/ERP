const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function run() {
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'migrations', 'v4_add_action_tracking.sql'), 'utf8');
        await pool.query(sql);
        console.log('Migration v4 applied successfully!');
    } catch (err) {
        console.error('Error applying migration:', err);
    } finally {
        await pool.end();
    }
}
run();
