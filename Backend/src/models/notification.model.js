const { pool } = require('../config/db.config');

const createNotificationsTable = async () => {
    try {
        const query = `
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                recipient_id INTEGER NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                type VARCHAR(50) DEFAULT 'info', -- CREATE, UPDATE, COMPLETE, DELETE, REMINDER, DUE
                related_id INTEGER, -- taskId
                is_read BOOLEAN DEFAULT false,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await pool.query(query);
        console.log('✅ Notifications table created or already exists');
    } catch (err) {
        console.error('❌ Error creating notifications table:', err);
    }
};

module.exports = {
    createNotificationsTable
};