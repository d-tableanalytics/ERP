const { pool } = require('../config/db.config');

const normalizeDepartmentName = (value) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

const canManageDepartments = (role) =>
    role === 'Admin' || role === 'SuperAdmin';

const departmentUsageQueries = [
    {
        key: 'employees',
        query: `SELECT COUNT(*)::int AS count FROM employees WHERE LOWER(TRIM(COALESCE(department, ''))) = LOWER(TRIM($1))`,
    },
    {
        key: 'delegation',
        query: `SELECT COUNT(*)::int AS count FROM delegation WHERE LOWER(TRIM(COALESCE(department, ''))) = LOWER(TRIM($1))`,
    },
    {
        key: 'checklist_master',
        query: `SELECT COUNT(*)::int AS count FROM checklist_master WHERE LOWER(TRIM(COALESCE(department, ''))) = LOWER(TRIM($1))`,
    },
    {
        key: 'checklist',
        query: `SELECT COUNT(*)::int AS count FROM checklist WHERE LOWER(TRIM(COALESCE(department, ''))) = LOWER(TRIM($1))`,
    },
    {
        key: 'advance_applications',
        query: `SELECT COUNT(*)::int AS count FROM advance_applications WHERE LOWER(TRIM(COALESCE(department, ''))) = LOWER(TRIM($1))`,
    },
];

// Get all employees (simplified list for dropdowns)
exports.getAllEmployees = async (req, res) => {
    try {
        const query = 'SELECT user_id as id, first_name as "First_Name", last_name as "Last_Name", work_email as email, department as "Department", role FROM employees WHERE deleted_at IS NULL ORDER BY first_name ASC';
        const result = await pool.query(query);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching employees' });
    }
};

// Get all departments
exports.getDepartments = async (req, res) => {
    try {
        const query = 'SELECT * FROM departments ORDER BY name ASC';
        const result = await pool.query(query);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching departments' });
    }
};

exports.createDepartment = async (req, res) => {
    if (!canManageDepartments(req.user?.role)) {
        return res.status(403).json({ success: false, message: 'You are not allowed to manage departments' });
    }

    const name = normalizeDepartmentName(req.body?.name);

    if (!name) {
        return res.status(400).json({ success: false, message: 'Department name is required' });
    }

    try {
        const existing = await pool.query(
            'SELECT id FROM departments WHERE LOWER(name) = LOWER($1)',
            [name]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Department already exists' });
        }

        const result = await pool.query(
            'INSERT INTO departments (name) VALUES ($1) RETURNING *',
            [name]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error creating department' });
    }
};

exports.updateDepartment = async (req, res) => {
    if (!canManageDepartments(req.user?.role)) {
        return res.status(403).json({ success: false, message: 'You are not allowed to manage departments' });
    }

    const departmentId = Number(req.params.id);
    const name = normalizeDepartmentName(req.body?.name);

    if (!Number.isInteger(departmentId)) {
        return res.status(400).json({ success: false, message: 'Invalid department id' });
    }

    if (!name) {
        return res.status(400).json({ success: false, message: 'Department name is required' });
    }

    let client;

    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const currentResult = await client.query(
            'SELECT * FROM departments WHERE id = $1',
            [departmentId]
        );

        if (currentResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Department not found' });
        }

        const currentDepartment = currentResult.rows[0];

        const existing = await client.query(
            'SELECT id FROM departments WHERE LOWER(name) = LOWER($1) AND id != $2',
            [name, departmentId]
        );

        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Department already exists' });
        }

        const updatedResult = await client.query(
            'UPDATE departments SET name = $1 WHERE id = $2 RETURNING *',
            [name, departmentId]
        );

        if (currentDepartment.name !== name) {
            const oldName = currentDepartment.name;
            const renameStatements = [
                'UPDATE employees SET department = $1 WHERE LOWER(TRIM(COALESCE(department, \'\'))) = LOWER(TRIM($2))',
                'UPDATE delegation SET department = $1 WHERE LOWER(TRIM(COALESCE(department, \'\'))) = LOWER(TRIM($2))',
                'UPDATE checklist_master SET department = $1 WHERE LOWER(TRIM(COALESCE(department, \'\'))) = LOWER(TRIM($2))',
                'UPDATE checklist SET department = $1 WHERE LOWER(TRIM(COALESCE(department, \'\'))) = LOWER(TRIM($2))',
                'UPDATE advance_applications SET department = $1 WHERE LOWER(TRIM(COALESCE(department, \'\'))) = LOWER(TRIM($2))',
            ];

            for (const statement of renameStatements) {
                await client.query(statement, [name, oldName]);
            }
        }

        await client.query('COMMIT');
        res.json({ success: true, data: updatedResult.rows[0] });
    } catch (err) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error(err);
        res.status(500).json({ success: false, message: 'Error updating department' });
    } finally {
        client?.release();
    }
};

exports.deleteDepartment = async (req, res) => {
    if (!canManageDepartments(req.user?.role)) {
        return res.status(403).json({ success: false, message: 'You are not allowed to manage departments' });
    }

    const departmentId = Number(req.params.id);

    if (!Number.isInteger(departmentId)) {
        return res.status(400).json({ success: false, message: 'Invalid department id' });
    }

    try {
        const departmentResult = await pool.query(
            'SELECT * FROM departments WHERE id = $1',
            [departmentId]
        );

        if (departmentResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }

        const department = departmentResult.rows[0];
        const usage = {};

        for (const item of departmentUsageQueries) {
            const usageResult = await pool.query(item.query, [department.name]);
            usage[item.key] = usageResult.rows[0].count;
        }

        const isInUse = Object.values(usage).some((count) => count > 0);

        if (isInUse) {
            return res.status(400).json({
                success: false,
                message: 'Department is in use and cannot be deleted',
                data: usage,
            });
        }

        await pool.query('DELETE FROM departments WHERE id = $1', [departmentId]);
        res.json({ success: true, data: { id: departmentId } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error deleting department' });
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
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching PC accountables' });
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
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching problem solvers' });
    }
};

// Get all locations
exports.getLocations = async (req, res) => {
    try {
        const query = 'SELECT id, name FROM locations ORDER BY name ASC';
        const result = await pool.query(query);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching locations' });
    }
};

// Delete an employee
exports.deleteEmployee = async (req, res) => {
    if (!canManageDepartments(req.user?.role)) {
        return res.status(403).json({ success: false, message: 'You are not allowed to manage employees' });
    }

    const employeeId = Number(req.params.id);

    if (!Number.isInteger(employeeId)) {
        return res.status(400).json({ success: false, message: 'Invalid employee id' });
    }

    try {
        const result = await pool.query('UPDATE employees SET deleted_at = NOW() WHERE user_id = $1 RETURNING *', [employeeId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        res.json({ success: true, message: 'Employee deleted successfully (soft delete)', data: { id: employeeId } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error deleting employee' });
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
