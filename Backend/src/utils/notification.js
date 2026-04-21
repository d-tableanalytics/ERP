const db = require('../config/db.config');

const createNotification = async (recipientId, title, message, type, relatedId) => {
    try {
        const query = `
            INSERT INTO notifications (recipient_id, title, message, type, related_id)
            VALUES ($1, $2, $3, $4, $5) RETURNING *`;
        const result = await db.query(query, [recipientId, title, message, type, relatedId]);
        return result.rows[0];
    } catch (err) {
        console.error('Error creating notification:', err);
        // Don't throw - notifications shouldn't break the main flow
        return null;
    }
};

module.exports = {
    createNotification
};
