const db = require('../config/db.config');
const { uploadToDrive } = require('../utils/googleDrive');
const { addBusinessHours } = require('../utils/dateUtils');

// Helper to generate Ticket No: HT-YYYYMMDD-XXXX
const generateTicketNo = async () => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const result = await db.query(
        "SELECT count(*) FROM help_tickets WHERE help_ticket_no LIKE $1",
        [`HT-${date}-%`]
    );
    const count = parseInt(result.rows[0].count) + 1;
    return `HT-${date}-${count.toString().padStart(4, '0')}`;
};

// Helper: Get Config & Holidays
const getTATConfig = async () => {
    const configRes = await db.query('SELECT * FROM help_ticket_config WHERE id = 1');
    const holidaysRes = await db.query('SELECT * FROM help_ticket_holidays');
    return {
        config: configRes.rows[0],
        holidays: holidaysRes.rows
    };
};

// Helper to record history
const recordHistory = async (client, ticketId, ticketNo, stage, oldValues, newValues, actionType, actionBy, remarks) => {
    const query = `
        INSERT INTO help_ticket_history (
            ticket_id, ticket_no, stage, old_values, new_values, action_type, action_by, remarks
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
    await client.query(query, [ticketId, ticketNo, stage, oldValues, newValues, actionType, actionBy, remarks]);
};

// Stage 1: Raise Ticket
exports.raiseTicket = async (req, res) => {
    const { location, pc_accountable, issue_description, desired_date, priority, problem_solver } = req.body;
    const raised_by = req.user.id;

    let image_upload = null;
    if (req.file) {
        try {
            // uploadToDrive(fileBuffer, filename, mimeType)
            image_upload = await uploadToDrive(
                req.file.buffer,
                req.file.originalname,
                req.file.mimetype
            );
        } catch (error) {
            console.error('Drive upload failed, expecting fallback or error', error);
            // fallback or error handling
        }
    }

    try {
        const help_ticket_no = await generateTicketNo();

        // Calculate PC Planned Date (Stage 2 TAT)
        const { config, holidays } = await getTATConfig();
        const pcPlannedDate = addBusinessHours(new Date(), config.stage2_tat_hours, config, holidays);

        const query = `
            INSERT INTO help_tickets (
                help_ticket_no, location, raised_by, pc_accountable, issue_description, 
                desired_date, image_upload, priority, current_stage, status,
                pc_planned_date, problem_solver
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, 'OPEN', $10, $9) RETURNING *`;

        const values = [
            help_ticket_no, location, raised_by, pc_accountable, issue_description,
            desired_date, image_upload, priority, problem_solver, pcPlannedDate
        ];

        const result = await db.query(query, values);

        // Record initial history
        const client = await db.pool.connect();
        try {
            await recordHistory(client, result.rows[0].id, help_ticket_no, 1, null, result.rows[0], 'TICKET_RAISED', raised_by, 'Ticket created');
        } finally {
            client.release();
        }

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error raising ticket' });
    }
};

// Stage 2: PC Planning
exports.pcPlanning = async (req, res) => {
    const { id } = req.params;
    const { pc_planned_date, problem_solver, pc_remark, pc_status } = req.body;
    const actionBy = req.user.id;

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const currentRes = await client.query('SELECT * FROM help_tickets WHERE id = $1', [id]);
        if (currentRes.rows.length === 0) throw new Error('Ticket not found');
        const oldValues = currentRes.rows[0];

        // Authorization Check: Only assigned PC can edit
        if (oldValues.pc_accountable !== actionBy) {
            throw new Error('Unauthorized: Only the assigned PC can perform this action');
        }

        const query = `
            UPDATE help_tickets SET
                pc_planned_date = $1,
                problem_solver = $2,
                pc_remark = $3,
                pc_status = $4, -- Updated Column
                pc_actual_date = CURRENT_TIMESTAMP,
                pc_time_difference = CURRENT_TIMESTAMP - created_at,
                current_stage = 2,
                status = 'IN_PLANNING',
                solver_planned_date = $1 -- Initial solver planned date matches PC planned date
            WHERE id = $5 RETURNING *`;

        const result = await client.query(query, [pc_planned_date, problem_solver, pc_remark, pc_status, id]);

        await recordHistory(client, id, oldValues.help_ticket_no, 2, oldValues, result.rows[0], 'PC_PLANNING_COMPLETE', actionBy, pc_remark);

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: err.message || 'Error in PC planning' });
    } finally {
        client.release();
    }
};

// Stage 3: Problem Solver - Solve
exports.solveTicket = async (req, res) => {
    const { id } = req.params;
    const { solver_remark } = req.body;

    let proof_upload = null;
    if (req.file) {
        try {
            proof_upload = await uploadToDrive(
                req.file.buffer,
                req.file.originalname,
                req.file.mimetype
            );
        } catch (error) {
            console.error('Drive upload failed', error);
        }
    }
    const actionBy = req.user.id;

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const currentRes = await client.query('SELECT * FROM help_tickets WHERE id = $1', [id]);
        if (currentRes.rows.length === 0) throw new Error('Ticket not found');
        const oldValues = currentRes.rows[0];

        // Calculate Stage 4 planned date
        const { config, holidays } = await getTATConfig();
        const pcPlannedStage4 = addBusinessHours(new Date(), config.stage4_tat_hours, config, holidays);

        const query = `
            UPDATE help_tickets SET
                solver_actual_date = CURRENT_TIMESTAMP,
                solver_remark = $1,
                proof_upload = $2,
                solver_time_difference = CURRENT_TIMESTAMP - pc_planned_date,
                current_stage = 3,
                status = 'SOLVED',
                pc_planned_stage4 = $4
            WHERE id = $3 RETURNING *`;

        const result = await client.query(query, [solver_remark, proof_upload, id, pcPlannedStage4]);

        await recordHistory(client, id, oldValues.help_ticket_no, 3, oldValues, result.rows[0], 'TICKET_SOLVED', actionBy, solver_remark);

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: err.message || 'Error solving ticket' });
    } finally {
        client.release();
    }
};

// Stage 3: Problem Solver - Revise Date
exports.reviseTicketDate = async (req, res) => {
    const { id } = req.params;
    const { solver_planned_date, solver_remark } = req.body;
    const actionBy = req.user.id;

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const currentRes = await client.query('SELECT * FROM help_tickets WHERE id = $1', [id]);
        if (currentRes.rows.length === 0) throw new Error('Ticket not found');
        const oldValues = currentRes.rows[0];

        const query = `
            UPDATE help_tickets SET
                solver_planned_date = $1,
                solver_remark = $2,
                revise_count = revise_count + 1
            WHERE id = $3 RETURNING *`;

        const result = await client.query(query, [solver_planned_date, solver_remark, id]);

        await recordHistory(client, id, oldValues.help_ticket_no, 3, oldValues, result.rows[0], 'DATE_REVISED', actionBy, solver_remark);

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: err.message || 'Error revising date' });
    } finally {
        client.release();
    }
};

// Stage 4: PC Confirmation
exports.pcConfirmation = async (req, res) => {
    const { id } = req.params;
    const { pc_status_stage4, pc_remark_stage4 } = req.body;
    const actionBy = req.user.id;

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const currentRes = await client.query('SELECT * FROM help_tickets WHERE id = $1', [id]);
        if (currentRes.rows.length === 0) throw new Error('Ticket not found');
        const oldValues = currentRes.rows[0];

        // Calculate Stage 5 Closing Planned Date
        const { config, holidays } = await getTATConfig();
        const closingPlanned = addBusinessHours(new Date(), config.stage5_tat_hours, config, holidays);

        const query = `
            UPDATE help_tickets SET
                pc_actual_stage4 = CURRENT_TIMESTAMP,
                pc_status_stage4 = $1,
                pc_remark_stage4 = $2,
                pc_time_difference_stage4 = CURRENT_TIMESTAMP - solver_actual_date,
                current_stage = 4,
                status = 'CONFIRMED',
                closing_planned = $4
            WHERE id = $3 RETURNING *`;

        const result = await client.query(query, [pc_status_stage4, pc_remark_stage4, id, closingPlanned]);

        await recordHistory(client, id, oldValues.help_ticket_no, 4, oldValues, result.rows[0], 'PC_CONFIRMED', actionBy, pc_remark_stage4);

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: err.message || 'Error in PC confirmation' });
    } finally {
        client.release();
    }
};

// Stage 5: Closure
exports.closeTicket = async (req, res) => {
    const { id } = req.params;
    const { closing_rating, closing_status, remarks } = req.body;
    const actionBy = req.user.id;

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const currentRes = await client.query('SELECT * FROM help_tickets WHERE id = $1', [id]);
        if (currentRes.rows.length === 0) throw new Error('Ticket not found');
        const oldValues = currentRes.rows[0];

        const query = `
            UPDATE help_tickets SET
                closing_actual = CURRENT_TIMESTAMP,
                closing_status = $1,
                closing_rating = $2,
                closing_time_difference = CURRENT_TIMESTAMP - pc_actual_stage4,
                current_stage = 5,
                status = 'CLOSED'
            WHERE id = $3 RETURNING *`;

        const result = await client.query(query, [closing_status, closing_rating, id]);

        await recordHistory(client, id, oldValues.help_ticket_no, 5, oldValues, result.rows[0], 'TICKET_CLOSED', actionBy, remarks || 'Ticket closed');

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: err.message || 'Error closing ticket' });
    } finally {
        client.release();
    }
};

// Stage 5: Re-raise
exports.reraiseTicket = async (req, res) => {
    const { id } = req.params;
    const { remarks } = req.body;
    const actionBy = req.user.id;

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const currentRes = await client.query('SELECT * FROM help_tickets WHERE id = $1', [id]);
        if (currentRes.rows.length === 0) throw new Error('Ticket not found');
        const oldValues = currentRes.rows[0];

        const query = `
            UPDATE help_tickets SET
                reraise_date = CURRENT_TIMESTAMP,
                current_stage = 1, -- Reset to stage 1
                status = 'RERAISED',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 RETURNING *`;

        const result = await client.query(query, [id]);

        await recordHistory(client, id, oldValues.help_ticket_no, 5, oldValues, result.rows[0], 'TICKET_RERAISED', actionBy, remarks);

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ message: err.message || 'Error re-raising ticket' });
    } finally {
        client.release();
    }
};

// List Tickets
exports.getTickets = async (req, res) => {
    try {
        const { stage, status, raised_by, filter_type } = req.query;
        const userId = req.user.id;
        let query = `
            SELECT t.*, 
                e1.First_Name || ' ' || e1.Last_Name as raiser_name,
                e2.First_Name || ' ' || e2.Last_Name as pc_name,
                e3.First_Name || ' ' || e3.Last_Name as solver_name
            FROM help_tickets t
            LEFT JOIN employees e1 ON t.raised_by = e1.user_id
            LEFT JOIN employees e2 ON t.pc_accountable = e2.user_id
            LEFT JOIN employees e3 ON t.problem_solver = e3.user_id
            WHERE 1=1`;

        const params = [];

        // Dashboard logic
        if (filter_type === 'assigned') {
            params.push(userId);
            query += ` AND (t.pc_accountable = $${params.length} OR t.problem_solver = $${params.length})`;
        } else if (filter_type === 'raised') {
            params.push(userId);
            query += ` AND t.raised_by = $${params.length}`;
        } else if (raised_by) {
            // legacy fallback
            params.push(raised_by);
            query += ` AND raised_by = $${params.length}`;
        }

        query += " ORDER BY t.created_at DESC";
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching tickets' });
    }
};

// Ticket Detail with History
exports.getTicketById = async (req, res) => {
    const { id } = req.params;
    try {
        const ticketRes = await db.query(`
            SELECT t.*, 
                e1.First_Name || ' ' || e1.Last_Name as raiser_name,
                e2.First_Name || ' ' || e2.Last_Name as pc_name,
                e3.First_Name || ' ' || e3.Last_Name as solver_name
            FROM help_tickets t
            LEFT JOIN employees e1 ON t.raised_by = e1."User_Id"
            LEFT JOIN employees e2 ON t.pc_accountable = e2."User_Id"
            LEFT JOIN employees e3 ON t.problem_solver = e3."User_Id"
            WHERE t.id = $1`, [id]);

        if (ticketRes.rows.length === 0) return res.status(404).json({ message: 'Ticket not found' });

        const historyRes = await db.query(`
            SELECT h.*, e.First_Name || ' ' || e.Last_Name as action_by_name
            FROM help_ticket_history h
            LEFT JOIN employees e ON h.action_by = e.user_id
            WHERE h.ticket_id = $1 ORDER BY h.action_date DESC`, [id]);

        res.json({
            ...ticketRes.rows[0],
            history: historyRes.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching ticket detail' });
    }
};
