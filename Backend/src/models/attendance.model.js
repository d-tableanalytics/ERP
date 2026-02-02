const { pool } = require('../config/db.config');

const createAttendanceTable = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS attendance (
            id SERIAL PRIMARY KEY,

            user_id INTEGER NOT NULL,
            attendance_date DATE DEFAULT CURRENT_DATE,

            in_time TIMESTAMP,
            out_time TIMESTAMP,
            status VARCHAR(50),
            remark TEXT,
            type_of_leave VARCHAR(100),
            location VARCHAR(255),
            houres_worked INTERVAL,
            
            CONSTRAINT unique_user_date UNIQUE (user_id, attendance_date),

            CONSTRAINT fk_attendance_user
                FOREIGN KEY (user_id)
                REFERENCES employees(user_id)
                ON DELETE CASCADE
        );
    `;

    try {
        await pool.query(queryText);
        console.log('Attendance table ensured in database');
    } catch (err) {
        console.error('Error creating attendance table:', err);
        throw err;
    }
};

module.exports = {
    createAttendanceTable,
};
