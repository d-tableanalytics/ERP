const db = require('../config/db.config');

exports.createHoliday = async (req, res) => {
    const { name, date } = req.body;
    const userId = req.user?.id || req.user?.User_Id;
    try {
        const query = 'INSERT INTO holidays (name, date, created_by) VALUES ($1, $2, $3) RETURNING *';
        const result = await db.query(query, [name, date, userId]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error creating holiday' });
    }
};

exports.getHolidays = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM holidays ORDER BY date ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching holidays' });
    }
};

exports.deleteHoliday = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM holidays WHERE id = $1', [id]);
        res.json({ message: 'Holiday deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error deleting holiday' });
    }
};
