const { pool } = require('../config/db.config');

const createDelegationExtrasTables = async () => {
    const categoryQuery = `
    CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        color VARCHAR(50) NOT NULL,
        created_by INTEGER,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    `;

    const tagQuery = `
    CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        color VARCHAR(50) NOT NULL,
        created_by INTEGER,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    `;

    const holidayQuery = `
    CREATE TABLE IF NOT EXISTS holidays (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        created_by INTEGER,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    `;

    const notificationPrefsQuery = `
    CREATE TABLE IF NOT EXISTS notification_preferences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE,
        whatsapp_notifications BOOLEAN DEFAULT false,
        email_notifications BOOLEAN DEFAULT false,
        timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
        daily_reminder_time VARCHAR(5) DEFAULT '09:00',
        whatsapp_reminders BOOLEAN DEFAULT false,
        email_reminders BOOLEAN DEFAULT false,
        daily_task_report BOOLEAN DEFAULT false,
        weekly_offs JSONB DEFAULT '["Sunday"]',
        notification_channels JSONB DEFAULT '{"newTask":{"admin":true,"manager":true,"member":true},"taskEdit":{"admin":true,"manager":true,"member":true},"taskComment":{"admin":true,"manager":true,"member":true},"taskInProgress":{"admin":true,"manager":true,"member":true},"taskComplete":{"admin":true,"manager":true,"member":true},"taskReOpen":{"admin":true,"manager":true,"member":true}}',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    `;

    const taskRemindersQuery = `
    CREATE TABLE IF NOT EXISTS delegation_reminders (
        id SERIAL PRIMARY KEY,
        delegation_id INTEGER REFERENCES delegation(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        time_value INTEGER NOT NULL,
        time_unit VARCHAR(50) NOT NULL,
        trigger_type VARCHAR(50) NOT NULL,
        reminder_time TIMESTAMPTZ NOT NULL,
        is_sent BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    `;

    try {
        await pool.query(categoryQuery);
        await pool.query(tagQuery);
        await pool.query(holidayQuery);
        await pool.query(notificationPrefsQuery);
        await pool.query(taskRemindersQuery);
        console.log('Delegation extras tables ensured in database');
    } catch (err) {
        console.error('Error creating delegation extras tables:', err);
        throw err;
    }
};

module.exports = {
    createDelegationExtrasTables,
};
