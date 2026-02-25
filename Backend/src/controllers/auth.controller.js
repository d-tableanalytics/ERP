const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db.config');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key_erp';

// Register Employee
exports.register = async (req, res) => {
    const {
        First_Name, Last_Name, Work_Email, Password, Role, Designation, Department, Joining_Date
    } = req.body;

    try {
        // Check if user exists
        const userExists = await db.query('SELECT * FROM employees WHERE Work_Email = $1', [Work_Email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ message: 'Employee with this email already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(Password, salt);

        // Insert employee
        const newEmployee = await db.query(
            `INSERT INTO employees (First_Name, Last_Name, Work_Email, Password, Role, Designation, Department, Joining_Date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [
                First_Name, Last_Name, Work_Email, hashedPassword,
                Role || 'Employee', Designation, Department,
                Joining_Date || new Date()
            ]
        );

        res.status(201).json({
            message: 'Employee registered successfully',
            user: {
                id: newEmployee.rows[0].user_id,
                email: newEmployee.rows[0].work_email,
                role: newEmployee.rows[0].role
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error during registration' });
    }
};

// Login Employee
exports.login = async (req, res) => {
    const { Work_Email, Password } = req.body;

    try {
        // Find employee
        const result = await db.query('SELECT * FROM employees WHERE Work_Email = $1', [Work_Email]);
        if (result.rows.length === 0) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const employee = result.rows[0];

        // Check password
        const isMatch = await bcrypt.compare(Password, employee.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: employee.user_id, email: employee.work_email, role: employee.role },
            JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            token,
            user: {
                id: employee.user_id,
                email: employee.work_email,
                role: employee.role,
                name: `${employee.first_name} ${employee.last_name}`,
                theme: employee.theme || 'light'
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error during login' });
    }
};

// Update Theme
exports.updateTheme = async (req, res) => {
    const { theme } = req.body;
    const userId = req.user.id;

    try {
        await db.query('UPDATE employees SET theme = $1 WHERE user_id = $2', [theme, userId]);
        res.json({ message: 'Theme updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error while updating theme' });
    }
};
