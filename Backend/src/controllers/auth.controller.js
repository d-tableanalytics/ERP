const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db.config');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_erp';

const normalizeEmail = (value) =>
    typeof value === 'string' ? value.trim().toLowerCase() : '';

// Register Employee
exports.register = async (req, res) => {
    const {
        First_Name, Last_Name, Work_Email, Password, Role, Designation, Department, Joining_Date
    } = req.body;
    const normalizedEmail = normalizeEmail(Work_Email || req.body.email);

    try {
        if (!normalizedEmail || !Password) {
            return res.status(400).json({ success: false, message: 'Work email and password are required' });
        }

        // Check if user exists
        const userExists = await db.query('SELECT * FROM employees WHERE LOWER(Work_Email) = $1', [normalizedEmail]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Employee with this email already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(Password, salt);

        // Insert employee
        const newEmployee = await db.query(
            `INSERT INTO employees (First_Name, Last_Name, Work_Email, Password, Role, Designation, Department, Joining_Date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [
                First_Name, Last_Name, normalizedEmail, hashedPassword,
                Role || 'Employee', Designation, Department,
                Joining_Date || new Date()
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Employee registered successfully',
            data: {
                user: {
                    id: newEmployee.rows[0].user_id,
                    email: newEmployee.rows[0].work_email,
                    role: newEmployee.rows[0].role
                }
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error during registration' });
    }
};

// Login Employee
exports.login = async (req, res) => {
    const email = normalizeEmail(req.body.Work_Email || req.body.email);
    const password = req.body.Password || req.body.password;

    try {
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Work email and password are required' });
        }

        // Find employee
        const result = await db.query('SELECT * FROM employees WHERE LOWER(Work_Email) = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        const employee = result.rows[0];

        // Check password
        const isMatch = await bcrypt.compare(password, employee.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: employee.user_id, email: employee.work_email, role: employee.role },
            JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: employee.user_id,
                    email: employee.work_email,
                    role: employee.role,
                    name: `${employee.first_name} ${employee.last_name}`,
                    theme: employee.theme || 'light'
                }
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
};

// Update Theme
exports.updateTheme = async (req, res) => {
    const { theme } = req.body;
    const userId = req.user.id;

    try {
        await db.query('UPDATE employees SET theme = $1 WHERE user_id = $2', [theme, userId]);
        res.json({ success: true, message: 'Theme updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error while updating theme' });
    }
};

// Get All Users
exports.getUsers = async (req, res) => {
    try {
        const result = await db.query('SELECT user_id, first_name, last_name, work_email, role, designation, department FROM employees');
        // Normalize names for frontend
        const users = result.rows.map(u => ({
            ...u,
            id: u.user_id,
            name: `${u.first_name} ${u.last_name}`,
            firstName: u.first_name,
            lastName: u.last_name,
            email: u.work_email,
            role: u.role,
            designation: u.designation,
            department: u.department
        }));
        res.json({ success: true, data: users });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error fetching users' });
    }
};
