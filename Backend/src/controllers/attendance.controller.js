const { pool } = require('../config/db.config');

/**
 * PUNCH IN API
 * POST /attendance/punch-in
 */

exports.getAttendanceList = async (req, res) => {
    try {
        const { user_id, date, month, department, status } = req.query;

        let query = `
            SELECT
                a.id,
                a.attendance_date,
                a.in_time,
                a.out_time,
                a.status,
                a.remark,
                a.type_of_leave,
                a.location,
                a.houres_worked,

                e.user_id,
                e.first_name,
                e.last_name,
                e.work_email,
                
                e.department,
                e.designation
            FROM attendance a
            JOIN employees e
              ON a.user_id = e.user_id
            WHERE 1 = 1
        `;

        const values = [];
        let index = 1;

        // 🔹 Filter by user_id
        if (user_id) {
            query += ` AND a.user_id = $${index++}`;
            values.push(user_id);
        }

        // 🔹 Filter by exact date
        if (date) {
            query += ` AND a.attendance_date = $${index++}`;
            values.push(date);
        }

        // 🔹 Filter by month (YYYY-MM)
        if (month) {
            query += ` AND DATE_TRUNC('month', a.attendance_date) = DATE_TRUNC('month', $${index++}::date)`;
            values.push(`${month}-01`);
        }

        // 🔹 Filter by department
        if (department) {
            query += ` AND e.department = $${index++}`;
            values.push(department);
        }

        // 🔹 Filter by status
        if (status) {
            query += ` AND a.status = $${index++}`;
            values.push(status);
        }

        query += ` ORDER BY a.attendance_date DESC, a.in_time DESC`;

        const result = await pool.query(query, values);

        res.json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Error fetching attendance list'
        });
    }
};


exports.punchIn = async (req, res) => {
    const { user_id, location } = req.body;

    if (!user_id) {
        return res.status(400).json({ message: 'user_id is required' });
    }

    try {
        // 1️⃣ Check if already punched in today
        const checkQuery = `
            SELECT id 
            FROM attendance
            WHERE user_id = $1
              AND attendance_date = CURRENT_DATE
        `;

        const checkResult = await pool.query(checkQuery, [user_id]);

        if (checkResult.rows.length > 0) {
            return res.status(409).json({
                message: 'Already punched in today'
            });
        }

        // 2️⃣ Calculate remark based on current time
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();

        let remark = 'On Time';
        let type_of_leave = null;

        if (hours > 14 || (hours === 14 && minutes > 0)) {
            remark = 'Half Day';
            type_of_leave = 'Half Day';
        } else if (hours > 12 || (hours === 12 && minutes > 0)) {
            remark = 'Short Leave';
            type_of_leave = 'Short Leave';
        } else if (hours > 10 || (hours === 10 && minutes > 30)) {
            remark = 'Late Mark';
        }

        // 3️⃣ Insert punch in
        const insertQuery = `
            INSERT INTO attendance (
                user_id,
                in_time,
                status,
                remark,
                type_of_leave,
                location
            )
            VALUES ($1, NOW(), 'Present', $2, $3, $4)
            RETURNING *
        `;

        const result = await pool.query(insertQuery, [
            user_id,
            remark,
            type_of_leave,
            location || null
        ]);

        res.status(201).json({
            message: 'Punch in successful',
            data: result.rows[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: 'Error during punch in'
        });
    }
};


/**
 * PUNCH OUT API
 * POST /attendance/punch-out
 */
exports.punchOut = async (req, res) => {
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).json({ message: 'user_id is required' });
    }

    try {
        // 1️⃣ Get today's attendance (with in_time)
        const fetchQuery = `
            SELECT id, in_time, out_time
            FROM attendance
            WHERE user_id = $1
              AND attendance_date = CURRENT_DATE
        `;

        const result = await pool.query(fetchQuery, [user_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: 'Punch in not found for today'
            });
        }

        const attendance = result.rows[0];

        if (attendance.out_time) {
            return res.status(409).json({
                message: 'Already punched out today'
            });
        }

        // 2️⃣ Update punch out + calculate hours_work
        const updateQuery = `
            UPDATE attendance
            SET 
                out_time = NOW(),
                houres_worked = ROUND(
                    EXTRACT(EPOCH FROM (NOW() - in_time)) / 3600,
                    2
                )
            WHERE id = $1
            RETURNING *
        `;

        const updateResult = await pool.query(updateQuery, [
            attendance.id
        ]);

        res.json({
            message: 'Punch out successful',
            data: updateResult.rows[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: 'Error during punch out'
        });
    }
};

