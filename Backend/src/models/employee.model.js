const { pool } = require('../config/db.config');

const createEmployeeTable = async () => {
    const queryText = `
    CREATE TABLE IF NOT EXISTS employees (
        User_Id SERIAL PRIMARY KEY,
        First_Name VARCHAR(50),
        Last_Name VARCHAR(50),
        Work_Email VARCHAR(100) UNIQUE NOT NULL,
        Personal_Email VARCHAR(100),
        Password VARCHAR(255) NOT NULL,
        Mobile_Number VARCHAR(20),
        Emergency_Mobile_No VARCHAR(20),
        Role VARCHAR(50) DEFAULT 'Employee',
        Designation VARCHAR(100),
        Department VARCHAR(100),
        Date_of_Birth DATE,
        Profile_Photo_URL TEXT,
        Resume_URL TEXT,
        Salary DECIMAL(10, 2),
        Last_Increment DECIMAL(10, 2),
        Current_Salary DECIMAL(10, 2),
        Joining_Date DATE DEFAULT CURRENT_DATE,
        Manager VARCHAR(100),
        Contract TEXT,
        Marital_Status VARCHAR(20),
        Anniversary_Date DATE,
        Gender VARCHAR(20),
        Address TEXT,
        City VARCHAR(50),
        State VARCHAR(50),
        Nationality VARCHAR(50),
        Theme VARCHAR(10) DEFAULT 'light',
        Created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        Updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
    try {
        await pool.query(queryText);
        console.log('Employees table ensured in database');
    } catch (err) {
        console.error('Error creating employees table:', err);
        throw err;
    }
};

module.exports = {
    createEmployeeTable,
};
