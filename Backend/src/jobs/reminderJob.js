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

// 1. Check custom reminders in task_reminders and delegation_reminders
const checkCustomReminders = async () => {
    try {
        // A. Check Task Reminders
        const taskQuery = `
            SELECT tr.*, t.task_title, t.task_title as "taskTitle", t.description, t.doer_id, t.doer_name, t.delegator_id, t.delegator_name, t.due_date, t.status, 'TASK' as source_type
            FROM task_reminders tr
            JOIN tasks t ON tr.task_id = t.id
            WHERE tr.is_sent = false 
            AND tr.reminder_time <= NOW()
            AND t.deleted_at IS NULL
            AND t.status NOT IN ('Completed', 'Verified', 'Cancelled')
        `;
        const taskResult = await db.query(taskQuery);

        for (const reminder of taskResult.rows) {
            await notifyUser('TASK_REMINDER', {
                ...reminder,
                id: reminder.task_id
            });
            await db.query('UPDATE task_reminders SET is_sent = true, updated_at = NOW() WHERE id = $1', [reminder.id]);
        }

        // B. Check Delegation Reminders
        const delegationQuery = `
            SELECT tr.*, d.delegation_name, d.delegation_name as "taskTitle", d.description, d.doer_id, d.doer_name, d.delegator_id, d.delegator_name, d.due_date, d.status, 'DELEGATION' as source_type
            FROM delegation_reminders tr
            JOIN delegation d ON tr.delegation_id = d.id
            WHERE tr.is_sent = false 
            AND tr.reminder_time <= NOW()
            AND d.deleted_at IS NULL
            AND d.status NOT IN ('COMPLETED', 'Completed', 'Cancelled')
        `;
        const delResult = await db.query(delegationQuery);

        for (const reminder of delResult.rows) {
            await notifyUser('TASK_REMINDER', {
                ...reminder,
                id: reminder.delegation_id
            });
            await db.query('UPDATE delegation_reminders SET is_sent = true, updated_at = NOW() WHERE id = $1', [reminder.id]);
        }
    } catch (err) {
        console.error('Error in checkCustomReminders:', err);
    }
};

// 2. Check for tasks/delegations due in next 24 hours
const checkDueSoonTasks = async () => {
    try {
        // A. Check Tasks
        const taskQuery = `
            SELECT t.*, 'TASK' as source_type
            FROM tasks t
            WHERE t.due_date <= NOW() + INTERVAL '24 hours'
            AND t.due_date > NOW()
            AND t.deleted_at IS NULL
            AND t.status NOT IN ('Completed', 'Verified', 'Cancelled')
            AND NOT EXISTS (
                SELECT 1 FROM notifications n 
                WHERE n.related_id = t.id 
                AND n.type = 'TASK_DUE_SOON'
                AND n.created_at > NOW() - INTERVAL '24 hours'
            )
        `;
        const taskRes = await db.query(taskQuery);
        for (const task of taskRes.rows) {
            await notifyUser('TASK_DUE_SOON', { ...task, id: task.id });
        }

        // B. Check Delegations
        const delQuery = `
            SELECT d.*, 'DELEGATION' as source_type
            FROM delegation d
            WHERE d.due_date <= NOW() + INTERVAL '24 hours'
            AND d.due_date > NOW()
            AND d.deleted_at IS NULL
            AND d.status NOT IN ('COMPLETED', 'Completed', 'Cancelled')
            AND NOT EXISTS (
                SELECT 1 FROM notifications n 
                WHERE n.related_id = d.id 
                AND n.type = 'TASK_DUE_SOON'
                AND n.created_at > NOW() - INTERVAL '24 hours'
            )
        `;
        const delRes = await db.query(delQuery);
        for (const task of delRes.rows) {
            await notifyUser('TASK_DUE_SOON', { ...task, id: task.id });
        }
    } catch (err) {
        console.error('Error in checkDueSoonTasks:', err);
    }
};

module.exports = {
    initReminderJob
};
