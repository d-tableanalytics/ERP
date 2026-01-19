const { pool } = require('../config/db.config');

// Get all employees (simplified list for dropdowns)
exports.getAllEmployees = async (req, res) => {
    try {
        const query = 'SELECT user_id as id, first_name as "First_Name", last_name as "Last_Name", work_email as email, department as "Department", role FROM employees ORDER BY first_name ASC';
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching employees' });
    }
};

// Get all departments
exports.getDepartments = async (req, res) => {
    try {
        const query = 'SELECT * FROM departments ORDER BY name ASC';
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching departments' });
    }
};

// Helper for IST Timestamp (Server side)
// Note: Usually handled by DB or by sending ISO strings, 
// but we can ensure the DB session is in IST if needed.
exports.setIST = async () => {
    try {
        await pool.query("SET TIME ZONE 'Asia/Kolkata'");
    } catch (err) {
        console.error('Error setting timezone:', err);
    }
};
