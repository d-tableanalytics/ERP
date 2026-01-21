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
const { createChecklistTables } = require('./src/models/checklist.model');
const { createHelpTicketTables } = require('./src/models/helpTicket.model');
const { createTodoTables } = require('./src/models/todo.model');
const { createLocationTable } = require('./src/models/location.model');

const authRoutes = require('./src/routes/auth.routes');
const delegationRoutes = require('./src/routes/delegation.routes');
const employeeRoutes = require('./src/routes/employee.routes');
const checklistRoutes = require('./src/routes/checklist.routes');
const helpTicketRoutes = require('./src/routes/helpTicket.routes');
const todoRoutes = require('./src/routes/todo.routes');

const { startChecklistCron } = require('./src/controllers/checklist.controller');

// Routes registration
app.use('/api/auth', authRoutes);
app.use('/api/delegations', delegationRoutes);
app.use('/api/master', employeeRoutes);
app.use('/api/checklist', checklistRoutes);
app.use('/api/help-tickets', helpTicketRoutes);
app.use('/api/todos', todoRoutes);

const fs = require('fs');
if (fs.existsSync('uploads')) {
    app.use('/uploads', express.static('uploads'));
}

// Initialize Database Tables
Promise.all([
    createEmployeeTable(),
    createDelegationTables(),
    createDepartmentTable(),
    createChecklistTables(),
    createHelpTicketTables(),
    createTodoTables(),
    createLocationTable(),
])
    .then(() => {
        console.log('Database synchronization complete');
        startChecklistCron(); // Start the daily task generation cron
    })
    .catch(err => console.error('Database synchronization failed:', err));

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app;
