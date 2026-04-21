const db = require('../config/db.config');

exports.getNotificationSettings = async (req, res) => {
    const userId = req.user.id || req.user.User_Id;
    try {
        const result = await db.query('SELECT * FROM notification_preferences WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) {
            // Return default settings
            return res.json({
                user_id: userId,
                whatsapp_notifications: false,
                email_notifications: false,
                timezone: 'Asia/Kolkata',
                daily_reminder_time: '09:00',
                whatsapp_reminders: false,
                email_reminders: false,
                daily_task_report: false,
                weekly_offs: ['Sunday'],
                notification_channels: {
                    newTask: { admin: true, manager: true, member: true },
                    taskEdit: { admin: true, manager: true, member: true },
                    taskComment: { admin: true, manager: true, member: true },
                    taskInProgress: { admin: true, manager: true, member: true },
                    taskComplete: { admin: true, manager: true, member: true },
                    taskReOpen: { admin: true, manager: true, member: true }
                }
            });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching notification settings' });
    }
};

exports.updateNotificationSettings = async (req, res) => {
    const userId = req.user.id || req.user.User_Id;
    const {
        whatsapp_notifications, email_notifications, timezone,
        daily_reminder_time, whatsapp_reminders, email_reminders,
        daily_task_report, weekly_offs, notification_channels
    } = req.body;

    try {
        const query = `
            INSERT INTO notification_preferences (
                user_id, whatsapp_notifications, email_notifications, timezone,
                daily_reminder_time, whatsapp_reminders, email_reminders,
                daily_task_report, weekly_offs, notification_channels, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                whatsapp_notifications = EXCLUDED.whatsapp_notifications,
                email_notifications = EXCLUDED.email_notifications,
                timezone = EXCLUDED.timezone,
                daily_reminder_time = EXCLUDED.daily_reminder_time,
                whatsapp_reminders = EXCLUDED.whatsapp_reminders,
                email_reminders = EXCLUDED.email_reminders,
                daily_task_report = EXCLUDED.daily_task_report,
                weekly_offs = EXCLUDED.weekly_offs,
                notification_channels = EXCLUDED.notification_channels,
                updated_at = NOW()
            RETURNING *`;

        const values = [
            userId, whatsapp_notifications, email_notifications, timezone,
            daily_reminder_time, whatsapp_reminders, email_reminders,
            daily_task_report, JSON.stringify(weekly_offs), JSON.stringify(notification_channels)
        ];

        const result = await db.query(query, values);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error updating notification settings' });
    }
};
