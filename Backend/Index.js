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
const { createDelegationTables } = require('./src/models/delegation.model');
const { createDepartmentTable } = require('./src/models/department.model');
const authRoutes = require('./src/routes/auth.routes');
const delegationRoutes = require('./src/routes/delegation.routes');
const employeeRoutes = require('./src/routes/employee.routes');
const checklistRoutes = require('./src/routes/checklist.routes');
const { createChecklistTables } = require('./src/models/checklist.model');
const { startChecklistCron } = require('./src/controllers/checklist.controller');

app.use('/api/auth', authRoutes);
app.use('/api/delegations', delegationRoutes);
app.use('/api/master', employeeRoutes);
app.use('/api/checklist', checklistRoutes);
app.use('/uploads', express.static('uploads'));

// Initialize Database Tables
Promise.all([
    createEmployeeTable(),
    createDelegationTables(),
    createDepartmentTable(),
    createChecklistTables(),
])
    .then(() => {
        console.log('Database synchronization complete');
        startChecklistCron(); // Start the daily task generation cron
    })
    .catch(err => console.error('Database synchronization failed:', err));

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
