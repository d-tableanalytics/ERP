const { pool } = require('./src/config/db.config');

async function testDelete() {
    try {
        const id = 2;
        console.log(`Attempting to delete employee ID: ${id}`);
        const result = await pool.query('DELETE FROM employees WHERE user_id = $1 RETURNING *', [id]);
        console.log('Result:', result.rows);
    } catch (err) {
        console.error('DELETE ERROR:', err.message);
        console.error('DETAIL:', err.detail);
        console.error('CONSTRAINT:', err.constraint);
    } finally {
        process.exit();
    }
}

testDelete();
