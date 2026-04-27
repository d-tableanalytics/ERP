const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db.config');

const runMigration = async () => {
    const migrationPath = path.join(__dirname, 'v3_add_approval_status.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    const client = await pool.connect();
    try {
        console.log('Starting v3 migration...');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('v3 Migration successful!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('v3 Migration failed:', err);
    } finally {
        client.release();
        process.exit();
    }
};

runMigration();
