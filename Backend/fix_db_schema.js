const { pool } = require('./src/config/db.config');

const fixSchema = async () => {
    try {
        console.log('🔌 Connecting to DB...');
        const client = await pool.connect();
        console.log('✅ Connected.');

        console.log('🛠️ Altering revision_history table...');
        await client.query(`
            ALTER TABLE revision_history 
            ADD COLUMN IF NOT EXISTS changed_by VARCHAR(255);
        `);
        console.log('✅ Column changed_by added (if it didn\'t exist).');

        client.release();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error updating schema:', err);
        process.exit(1);
    }
};

fixSchema();
