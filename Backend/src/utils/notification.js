const db = require('../config/db.config');
const { sendNotificationEmail } = require('./emailService');

const createNotification = async (recipientId, title, message, type, relatedId) => {
    try {
        const query = `
            INSERT INTO notifications (recipient_id, title, message, type, related_id)
            VALUES ($1, $2, $3, $4, $5) RETURNING *`;
        const result = await db.query(query, [recipientId, title, message, type, relatedId]);
        const notification = result.rows[0];

        // Send email notification if user has email notifications enabled
        await sendEmailNotification(recipientId, title, message, type);

        return notification;
    } catch (err) {
        console.error('Error creating notification:', err);
        // Don't throw - notifications shouldn't break the main flow
        return null;
    }
};

// Send email notification if user has it enabled
const sendEmailNotification = async (recipientId, title, message, type) => {
    try {
        // Get user's email and notification preferences
        const userQuery = `
            SELECT e.work_email, np.email_notifications
            FROM employees e
            LEFT JOIN notification_preferences np ON e.id = np.user_id
            WHERE e.id = $1`;
        const userResult = await db.query(userQuery, [recipientId]);

        if (userResult.rows.length > 0) {
            const { work_email, email_notifications } = userResult.rows[0];

            // Send email if user has email notifications enabled and has an email
            if (email_notifications && work_email) {
                await sendNotificationEmail(work_email, title, message, type);
            }
        }
    } catch (err) {
        console.error('Error sending email notification:', err);
        // Don't throw - email failures shouldn't break the main flow
    }
};

module.exports = {
    createNotification,
    sendEmailNotification
};
