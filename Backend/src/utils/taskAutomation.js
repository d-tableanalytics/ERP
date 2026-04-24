const db = require('../config/db.config');
const cron = require('node-cron');
const { Task } = require('../models/task.model');
const { createNotification } = require('./notification');

const processRecurringTasks = async () => {
    console.log('Running task automation job...');
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const todayDay = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(); // MON, TUE, etc.
    const todayDate = now.getDate().toString().padStart(2, '0'); // 01, 02, etc.
    
    // Check if it's the last day of the month
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isLastDayOfMonth = tomorrow.getMonth() !== now.getMonth();

    try {
        // Fetch all active recurring tasks
        const query = `
            SELECT * FROM delegation 
            WHERE record_source = 'task' 
            AND deleted_at IS NULL 
            AND (repeat_settings->>'isRepeat')::boolean = true
            AND (
                repeat_settings->>'repeatEndDate' IS NULL 
                OR repeat_settings->>'repeatEndDate' = '' 
                OR (repeat_settings->>'repeatEndDate')::date >= $1::date
            )
            AND (repeat_settings->>'repeatStartDate')::date <= $1::date
        `;
        
        const result = await db.pool.query(query, [todayStr]);
        const tasks = result.rows;

        for (const task of tasks) {
            const settings = typeof task.repeat_settings === 'string' ? JSON.parse(task.repeat_settings) : task.repeat_settings;
            let shouldCreate = false;

            if (settings.repeatFrequency === 'Daily') {
                shouldCreate = true;
            } else if (settings.repeatFrequency === 'Weekly') {
                if (settings.weeklyDays && settings.weeklyDays.includes(todayDay)) {
                    shouldCreate = true;
                }
            } else if (settings.repeatFrequency === 'Monthly') {
                if (settings.selectedDates && settings.selectedDates.includes(todayDate)) {
                    shouldCreate = true;
                }
                if (settings.isLastDayOfMonth && isLastDayOfMonth) {
                    shouldCreate = true;
                }
            } else if (settings.repeatFrequency === 'Periodical') {
                // For periodical, we check the diff between today and startDate
                const startDate = new Date(settings.repeatStartDate);
                const diffTime = Math.abs(now - startDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const interval = parseInt(settings.repeatIntervalDays || '1');
                if (diffDays % interval === 0) {
                    shouldCreate = true;
                }
            } else if (settings.repeatFrequency === 'Custom') {
                if (settings.occurEveryMode === 'Week') {
                    // Custom Weekly: check days
                    if (settings.customOccurDays && settings.customOccurDays.includes(todayDay)) {
                        shouldCreate = true;
                    }
                } else if (settings.occurEveryMode === 'Month') {
                    // Custom Monthly: check dates or last day
                    if (settings.selectedDates && settings.selectedDates.includes(todayDate)) {
                        shouldCreate = true;
                    }
                    if (settings.isLastDayOfMonth && isLastDayOfMonth) {
                        shouldCreate = true;
                    }
                }
            }

            if (shouldCreate) {
                // Prevent duplicate creation for today (check if a child task exists for today)
                const duplicateCheck = await db.pool.query(
                    'SELECT id FROM delegation WHERE parent_id = $1 AND created_at::date = $2::date',
                    [task.id, todayStr]
                );

                if (duplicateCheck.rows.length === 0) {
                    // Calculate due date based on today's date but preserve the time from the original due_date
                    const originalDueDate = task.due_date ? new Date(task.due_date) : null;
                    const nextDueDate = new Date(now);
                    if (originalDueDate) {
                        nextDueDate.setHours(originalDueDate.getHours(), originalDueDate.getMinutes(), originalDueDate.getSeconds(), originalDueDate.getMilliseconds());
                    } else {
                        nextDueDate.setHours(23, 59, 59, 999);
                    }

                    const newTaskData = {
                        delegation_name: task.delegation_name,
                        description: task.description,
                        delegator_id: task.delegator_id,
                        delegator_name: task.delegator_name,
                        doer_id: task.doer_id,
                        doer_name: task.doer_name,
                        department: task.department,
                        priority: task.priority,
                        due_date: nextDueDate.toISOString(),
                        voice_note_url: task.voice_note_url,
                        reference_docs: task.reference_docs,
                        evidence_required: task.evidence_required,
                        status: 'Pending',
                        category: task.category,
                        tags: task.tags,
                        checklist: task.checklist,
                        repeat_settings: { ...settings, isRepeat: false }, // Child tasks are not recurring
                        in_loop_ids: task.in_loop_ids,
                        group_id: task.group_id,
                        parent_id: task.id,
                        record_source: 'task'
                    };

                    await Task.create(newTaskData);
                    console.log(`Generated recurring task instance for Task ID: ${task.id}`);
                    
                    // Notification
                    if (task.doer_id !== task.delegator_id) {
                        await createNotification(
                            task.doer_id,
                            'TASK_ASSIGNED',
                            `Recurring task instance generated: ${task.delegation_name}`,
                            `/delegation/${task.id}`, // Link to parent or new task? Usually parent is fine for context
                            task.delegator_id
                        );
                    }
                }
            }
        }
        console.log('Task automation job complete.');
    } catch (err) {
        console.error('Error in processRecurringTasks:', err);
    }
};

const startTaskAutomationCron = () => {
    // Schedule to run every day at 00:05 AM (to avoid overlap with checklist cron)
    cron.schedule('5 0 * * *', processRecurringTasks);
    console.log('Task automation cron job scheduled (00:05 AM daily).');
};

module.exports = {
    processRecurringTasks,
    startTaskAutomationCron
};
