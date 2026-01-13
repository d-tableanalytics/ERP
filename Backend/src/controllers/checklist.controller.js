const db = require('../config/db.config');
const cron = require('node-cron');

// Create a new master template
exports.createChecklistMaster = async (req, res) => {
    const {
        question, assignee_id, doer_id, priority, department,
        verification_required, verifier_id, attachment_required,
        frequency, from_date, due_date, weekly_days, selected_dates
    } = req.body;

    try {
        const query = `
            INSERT INTO checklist_master (
                question, assignee_id, doer_id, priority, department,
                verification_required, verifier_id, attachment_required,
                frequency, from_date, due_date, weekly_days, selected_dates
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`;

        const values = [
            question, assignee_id, doer_id, priority, department,
            verification_required, verifier_id, attachment_required,
            frequency, from_date, due_date, weekly_days, selected_dates
        ];

        const result = await db.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating checklist master:', err);
        res.status(500).json({ message: 'Error creating checklist master' });
    }
};

// Update template details
exports.updateChecklistMaster = async (req, res) => {
    const { id } = req.params;
    const {
        question, assignee_id, doer_id, priority, department,
        verification_required, verifier_id, attachment_required,
        frequency, from_date, due_date, weekly_days, selected_dates
    } = req.body;

    try {
        const query = `
            UPDATE checklist_master SET
                question = $1, assignee_id = $2, doer_id = $3, priority = $4, department = $5,
                verification_required = $6, verifier_id = $7, attachment_required = $8,
                frequency = $9, from_date = $10, due_date = $11, weekly_days = $12, selected_dates = $13
            WHERE id = $14 RETURNING *`;

        const values = [
            question, assignee_id, doer_id, priority, department,
            verification_required, verifier_id, attachment_required,
            frequency, from_date, due_date, weekly_days, selected_dates, id
        ];

        const result = await db.query(query, values);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Template not found' });
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Error updating checklist master:', err);
        res.status(500).json({ message: 'Error updating checklist master' });
    }
};

// Delete a template
exports.deleteChecklistMaster = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM checklist_master WHERE id = $1', [id]);
        res.status(200).json({ message: 'Template deleted successfully' });
    } catch (err) {
        console.error('Error deleting checklist master:', err);
        res.status(500).json({ message: 'Error deleting checklist master' });
    }
};

// Update checklist status
exports.updateChecklistStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const query = 'UPDATE checklist SET status = $1 WHERE id = $2 RETURNING *';
        const result = await db.query(query, [status, id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Checklist task not found' });
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Error updating checklist status:', err);
        res.status(500).json({ message: 'Error updating checklist status' });
    }
};

// Delete a specific task instance
exports.deleteChecklistTask = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM checklist WHERE id = $1', [id]);
        res.status(200).json({ message: 'Checklist task deleted successfully' });
    } catch (err) {
        console.error('Error deleting checklist task:', err);
        res.status(500).json({ message: 'Error deleting checklist task' });
    }
};

// Automation Logic: Generate daily tasks
const generateDailyTasks = async () => {
    console.log('Running daily checklist task generation...');
    const now = new Date();
    const todayName = now.toLocaleDateString('en-US', { weekday: 'long' });
    const todayDate = now.getDate();

    try {
        const mastersRequest = await db.query('SELECT * FROM checklist_master');
        const masters = mastersRequest.rows;

        for (const master of masters) {
            let shouldCreate = false;

            if (master.frequency === 'daily') {
                shouldCreate = true;
            } else if (master.frequency === 'weekly' && master.weekly_days.includes(todayName)) {
                shouldCreate = true;
            } else if (master.frequency === 'monthly' && master.selected_dates.includes(todayDate)) {
                shouldCreate = true;
            }

            if (shouldCreate) {
                // Prevent duplicate creation for today
                const duplicateCheck = await db.query(
                    'SELECT id FROM checklist WHERE master_id = $1 AND created_at = CURRENT_DATE',
                    [master.id]
                );

                if (duplicateCheck.rows.length === 0) {
                    const insertQuery = `
                        INSERT INTO checklist (
                            master_id, question, assignee_id, doer_id, priority, department,
                            verification_required, verifier_id, attachment_required, frequency
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`;

                    const values = [
                        master.id, master.question, master.assignee_id, master.doer_id,
                        master.priority, master.department, master.verification_required,
                        master.verifier_id, master.attachment_required, master.frequency
                    ];

                    await db.query(insertQuery, values);
                    console.log(`Generated task for master ID: ${master.id}`);
                }
            }
        }
        console.log('Daily checklist task generation complete.');
    } catch (err) {
        console.error('Error in generateDailyTasks cron job:', err);
    }
};

// Start Cron Job (daily at 00:00)
exports.startChecklistCron = () => {
    cron.schedule('0 0 * * *', generateDailyTasks);
    console.log('Checklist automation cron job scheduled.');
};

// Export for manual testing if needed
exports.generateDailyTasks = generateDailyTasks;
