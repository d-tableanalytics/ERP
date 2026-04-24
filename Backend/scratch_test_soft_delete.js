const { pool } = require('./src/config/db.config');

async function testSoftDelete() {
    try {
        const id = 2;
        console.log(`Attempting to soft delete employee ID: ${id}`);
        const result = await pool.query('UPDATE employees SET deleted_at = NOW() WHERE user_id = $1 RETURNING *', [id]);
        if (result.rows.length > 0) {
            console.log('Success: Employee soft deleted.');
            console.log('Deleted At:', result.rows[0].deleted_at);
        } else {
            console.log('Failed: Employee not found.');
        }

        console.log('\nChecking if employee appears in getAll query...');
        const list = await pool.query('SELECT user_id FROM employees WHERE deleted_at IS NULL AND user_id = $1', [id]);
        if (list.rows.length === 0) {
            console.log('Success: Employee is filtered out from active list.');
        } else {
            console.log('Error: Employee still appears in active list.');
        }

    } catch (err) {
        console.error('TEST ERROR:', err.message);
    } finally {
        process.exit();
    }
}

testSoftDelete();
