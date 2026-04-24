const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db.config');

const runMigration = async () => {
    const migrationPath = path.join(__dirname, 'v1_split_tables.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    const client = await pool.connect();
    try {
        console.log('Starting migration...');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('Migration successful!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', err);
    } finally {
        client.release();
        process.exit();
    }
};

runMigration();
