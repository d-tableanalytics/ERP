const { pool } = require('../config/db.config');

// Get Config
exports.getConfig = async (req, res) => {
    try {
        const configRes = await pool.query('SELECT * FROM help_ticket_config WHERE id = 1');
        const holidaysRes = await pool.query('SELECT * FROM help_ticket_holidays WHERE holiday_date >= CURRENT_DATE ORDER BY holiday_date ASC');

        if (configRes.rows.length === 0) {
            return res.status(404).json({ message: 'Configuration not found' });
        }

        res.json({
            settings: configRes.rows[0],
            holidays: holidaysRes.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching configuration' });
    }
};

// Update Config
exports.updateConfig = async (req, res) => {
    const { stage2_tat_hours, stage4_tat_hours, stage5_tat_hours, office_start_time, office_end_time, working_days } = req.body;

    try {
        const query = `
            UPDATE help_ticket_config SET
                stage2_tat_hours = COALESCE($1, stage2_tat_hours),
                stage4_tat_hours = COALESCE($2, stage4_tat_hours),
                stage5_tat_hours = COALESCE($3, stage5_tat_hours),
                office_start_time = COALESCE($4, office_start_time),
                office_end_time = COALESCE($5, office_end_time),
                working_days = COALESCE($6, working_days),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1 RETURNING *`;

        const result = await pool.query(query, [stage2_tat_hours, stage4_tat_hours, stage5_tat_hours, office_start_time, office_end_time, JSON.stringify(working_days)]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error updating configuration' });
    }
};

// Add Holiday
exports.addHoliday = async (req, res) => {
    const { holiday_date, description } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO help_ticket_holidays (holiday_date, description) VALUES ($1, $2) RETURNING *',
            [holiday_date, description]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        if (err.code === '23505') { // Unique violation
            return res.status(400).json({ message: 'Holiday already exists for this date' });
        }
        res.status(500).json({ message: 'Error adding holiday' });
    }
};

// Remove Holiday
exports.removeHoliday = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM help_ticket_holidays WHERE id = $1', [id]);
        res.json({ message: 'Holiday removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error removing holiday' });
    }
};
