const { pool } = require('../config/db.config');

// Get all employees (simplified list for dropdowns)
exports.getAllEmployees = async (req, res) => {
    try {
        const query = 'SELECT user_id as id, first_name as "First_Name", last_name as "Last_Name", work_email as email, department as "Department" FROM employees ORDER BY first_name ASC';
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

// Get PC/EA accountables
exports.getPCAccountables = async (req, res) => {
    try {
        const query = `
            SELECT user_id as id, first_name || ' ' || last_name as name 
            FROM employees 
            WHERE designation IN ('PC', 'EA') 
            ORDER BY first_name ASC`;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching PC accountables' });
    }
};

// Get problem solvers (all except logged in user)
exports.getProblemSolvers = async (req, res) => {
    try {
        const loggedInUserId = req.user.id;
        const query = `
            SELECT user_id as id, first_name || ' ' || last_name as name 
            FROM employees 
            WHERE user_id != $1 
            ORDER BY first_name ASC`;
        const result = await pool.query(query, [loggedInUserId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching problem solvers' });
    }
};

// Get all locations
exports.getLocations = async (req, res) => {
    try {
        const query = 'SELECT id, name FROM locations ORDER BY name ASC';
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching locations' });
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
