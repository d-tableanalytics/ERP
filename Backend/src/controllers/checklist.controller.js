const db = require('../config/db.config');
const cron = require('node-cron');

// Create a new master template
exports.createChecklistMaster = async (req, res) => {

    const {
        question, assignee_id, assignee_name, doer_id, doer_name, priority, department,
        verification_required, verifier_id, verifier_name, attachment_required,
        frequency, from_date, due_date, weekly_days, selected_dates
    } = req.body;

    try {
        const query = `
            INSERT INTO checklist_master (
                question, assignee_id, assignee_name, doer_id, doer_name, priority, department,
                verification_required, verifier_id, verifier_name, attachment_required,
                frequency, from_date, due_date, weekly_days, selected_dates
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`;

        const values = [
            question,
            assignee_id || null, // Convert '' or undefined to null
            assignee_name,
            doer_id || null,     // Convert '' to null (Fixes invalid input syntax for integer)
            doer_name,
            priority,
            department,
            verification_required,
            verifier_id || null, // Convert '' to null
            verifier_name,
            attachment_required,
            frequency,
            from_date,
            due_date,
            weekly_days,
            selected_dates
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
        question, assignee_id, assignee_name, doer_id, doer_name, priority, department,
        verification_required, verifier_id, verifier_name, attachment_required,
        frequency, from_date, due_date, weekly_days, selected_dates
    } = req.body;

    try {
        const query = `
            UPDATE checklist_master SET
                question = $1, assignee_id = $2, assignee_name = $3, doer_id = $4, doer_name = $5, priority = $6, department = $7,
                verification_required = $8, verifier_id = $9, verifier_name = $10, attachment_required = $11,
                frequency = $12, from_date = $13, due_date = $14, weekly_days = $15, selected_dates = $16
            WHERE id = $17 RETURNING *`;

        const values = [
            question,
            assignee_id || null,
            assignee_name,
            doer_id || null,
            doer_name,
            priority,
            department,
            verification_required,
            verifier_id || null,
            verifier_name,
            attachment_required,
            frequency,
            from_date,
            due_date,
            weekly_days,
            selected_dates,
            id
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
        const query = 'UPDATE checklist SET status = $1, proof_file_path = COALESCE($2, proof_file_path) WHERE id = $3 RETURNING *';

        let proofPath = null;
        if (req.file) {
            const fileName = `proof_${id}_${Date.now()}_${req.file.originalname}`;
            const filePath = `uploads/${fileName}`;
            require('fs').writeFileSync(filePath, req.file.buffer);
            proofPath = filePath;
        }

        const result = await db.query(query, [status, proofPath, id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Checklist task not found' });
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Error updating checklist status:', err);
        res.status(500).json({ message: 'Error updating checklist status' });
    }
};

// Update checklist task details (Edit)
exports.updateChecklistTaskDetails = async (req, res) => {
    const { id } = req.params;

    const {
        question, assignee_id, assignee_name, doer_id, doer_name, priority, department,
        verification_required, verifier_id, verifier_name, attachment_required, due_date
    } = req.body;


    try {
        const query = `
            UPDATE checklist SET
                question = COALESCE($1, question),
                assignee_id = COALESCE($2, assignee_id),
                assignee_name = COALESCE($3, assignee_name),
                doer_id = COALESCE($4, doer_id),
                doer_name = COALESCE($5, doer_name),
                priority = COALESCE($6, priority),
                department = COALESCE($7, department),
                verification_required = COALESCE($8, verification_required),
                verifier_id = COALESCE($9, verifier_id),
                verifier_name = COALESCE($10, verifier_name),
                attachment_required = COALESCE($11, attachment_required),
                due_date = COALESCE($12, due_date)
            WHERE id = $13 RETURNING *`;

        const values = [
            question,
            assignee_id || null,
            assignee_name,
            doer_id || null,
            doer_name,
            priority,
            department,
            verification_required,
            verifier_id || null,
            verifier_name,
            attachment_required,
            (due_date === '' || due_date === undefined) ? null : due_date,
            id
        ];

        const result = await db.query(query, values);

        if (result.rows.length === 0) return res.status(404).json({ message: 'Checklist task not found' });
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Error updating checklist details:', err);
        res.status(500).json({ message: 'Error updating checklist details' });
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

// Get all checklist tasks (with filtering)
exports.getChecklists = async (req, res) => {
    const { role, id: userId, User_Id } = req.user;
    const currentUserId = userId || User_Id; // Handle potential inconsistent naming

    try {
        let query;
        let queryParams = [];

        if (role === 'Admin' || role === 'SuperAdmin') {
            query = `
                SELECT 
                    c.*, 
                    COALESCE(NULLIF(TRIM(CONCAT(e1.First_Name, ' ', e1.Last_Name)), ''), c.assignee_name) as assignee_name,
                    COALESCE(NULLIF(TRIM(CONCAT(e2.First_Name, ' ', e2.Last_Name)), ''), c.doer_name) as doer_name
                FROM checklist c
                LEFT JOIN employees e1 ON c.assignee_id = e1.User_Id
                LEFT JOIN employees e2 ON c.doer_id = e2.User_Id
                ORDER BY c.id DESC
            `;
        } else {
            // Ensure non-admins only see tasks where they are Assignee, Doer, or Verifier
            query = `
                SELECT 
                    c.*, 
                    COALESCE(NULLIF(TRIM(CONCAT(e1.First_Name, ' ', e1.Last_Name)), ''), c.assignee_name) as assignee_name,
                    COALESCE(NULLIF(TRIM(CONCAT(e2.First_Name, ' ', e2.Last_Name)), ''), c.doer_name) as doer_name
                FROM checklist c
                LEFT JOIN employees e1 ON c.assignee_id = e1.User_Id
                LEFT JOIN employees e2 ON c.doer_id = e2.User_Id
                WHERE c.assignee_id = $1 OR c.doer_id = $1 OR c.verifier_id = $1
                ORDER BY c.id DESC
            `;
            queryParams = [currentUserId];
        }

        const result = await db.query(query, queryParams);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching checklists:', err);
        res.status(500).json({ message: 'Error fetching checklists' });
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
            } else if (master.frequency === 'quarterly') {
                const startDate = new Date(master.from_date);
                const startMonth = startDate.getMonth();
                const currentMonth = now.getMonth();
                // Check if date matches AND month diff is multiple of 3
                if (master.selected_dates.includes(todayDate) && (currentMonth - startMonth + 12) % 3 === 0) {
                    shouldCreate = true;
                }
            } else if (master.frequency === 'yearly') {
                const startDate = new Date(master.from_date);
                const startMonth = startDate.getMonth();
                const currentMonth = now.getMonth();
                // Check if date matches AND month matches
                if (master.selected_dates.includes(todayDate) && currentMonth === startMonth) {
                    shouldCreate = true;
                }
            }

            if (shouldCreate) {
                // Prevent duplicate creation for today
                const duplicateCheck = await db.query(
                    'SELECT id FROM checklist WHERE master_id = $1 AND created_at = CURRENT_DATE',
                    [master.id]
                );

                if (duplicateCheck.rows.length === 0) {
                    // Default due_date to end of today (23:59:59) for daily tasks
                    const dueDate = new Date();
                    dueDate.setHours(23, 59, 59, 999);

                    const insertQuery = `
                        INSERT INTO checklist (
                            master_id, question, assignee_id, assignee_name, doer_id, doer_name, priority, department,
                            verification_required, verifier_id, verifier_name, attachment_required, frequency, due_date
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`;

                    const values = [
                        master.id, master.question, master.assignee_id, master.assignee_name, master.doer_id, master.doer_name,
                        master.priority, master.department, master.verification_required,
                        master.verifier_id, master.verifier_name, master.attachment_required, master.frequency, dueDate
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
