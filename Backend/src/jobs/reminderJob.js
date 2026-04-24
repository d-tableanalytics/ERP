const cron = require('node-cron');
const db = require('../config/db.config');
const { notifyUser } = require('../services/notificationService');

// Run every minute
const initReminderJob = () => {
    cron.schedule('* * * * *', async () => {
        // console.log('Checking for reminders and due tasks...');
        await checkCustomReminders();
        await checkDueSoonTasks();
    });
    console.log('✅ Reminder cron job initialized');
};

// 1. Check task_reminders table
const checkCustomReminders = async () => {
    try {
        const query = `
            SELECT tr.*, d.delegation_name, d.delegation_name as "taskTitle", d.description, d.doer_id, d.doer_name, d.delegator_id, d.delegator_name, d.due_date, d.status
            FROM task_reminders tr
            JOIN delegation d ON tr.delegation_id = d.id
            WHERE tr.is_sent = false 
            AND tr.reminder_time <= NOW()
            AND d.deleted_at IS NULL
            AND d.status NOT IN ('Completed', 'Cancelled')
        `;
        const result = await db.query(query);

        for (const reminder of result.rows) {
            await notifyUser('TASK_REMINDER', {
                ...reminder,
                id: reminder.delegation_id
            });

            // Mark as sent
            await db.query('UPDATE task_reminders SET is_sent = true, updated_at = NOW() WHERE id = $1', [reminder.id]);
        }
    } catch (err) {
        console.error('Error in checkCustomReminders:', err);
    }
};

// 2. Check for tasks due in next 24 hours (that haven't been notified yet for "Due Soon")
const checkDueSoonTasks = async () => {
    try {
        // We can use a metadata field or a separate table to track if "due soon" was sent
        // For simplicity, let's check tasks due in (NOW + 24h) and (NOW + 23h) range, or just use a flag
        // Let's add a 'due_soon_notified' column to delegation table if not present, 
        // or just use the notifications table to check.
        
        const query = `
            SELECT d.* 
            FROM delegation d
            WHERE d.due_date <= NOW() + INTERVAL '24 hours'
            AND d.due_date > NOW()
            AND d.deleted_at IS NULL
            AND d.status NOT IN ('Completed', 'Cancelled')
            AND NOT EXISTS (
                SELECT 1 FROM notifications n 
                WHERE n.related_id = d.id 
                AND n.type = 'TASK_DUE_SOON'
                AND n.created_at > NOW() - INTERVAL '24 hours'
            )
        `;
        const result = await db.query(query);

        for (const task of result.rows) {
            await notifyUser('TASK_DUE_SOON', {
                ...task,
                id: task.id
            });
        }
    } catch (err) {
        console.error('Error in checkDueSoonTasks:', err);
    }
};

module.exports = {
    initReminderJob
};
