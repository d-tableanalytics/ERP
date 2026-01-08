require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool } = require('./src/config/db.config');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Main Route
app.get('/', (req, res) => {
    res.send('ERP Backend is running');
});

// Import Models & Routes
const { createEmployeeTable } = require('./src/models/employee.model');
const authRoutes = require('./src/routes/auth.routes');

app.use('/api/auth', authRoutes);

// Initialize Database Tables
createEmployeeTable()
    .then(() => console.log('Database synchronization complete'))
    .catch(err => console.error('Database synchronization failed:', err));

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
