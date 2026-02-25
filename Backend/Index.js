require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { pool } = require("./src/config/db.config");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Main Route
app.get("/", (req, res) => {
  res.send("ERP Backend is running");
});

// Import Models & Routes
const { createEmployeeTable } = require("./src/models/employee.model");
const { createDelegationTables } = require("./src/models/delegation.model");
const { createDepartmentTable } = require("./src/models/department.model");
const { createChecklistTables } = require("./src/models/checklist.model");
const { createHelpTicketTables } = require("./src/models/helpTicket.model");
const { createTodoTables } = require("./src/models/todo.model");
const { createLocationTable } = require("./src/models/location.model");
const {
  createHelpTicketConfigTable,
} = require("./src/models/helpTicketConfig.model");
const {
  startChecklistCron,
} = require("./src/controllers/checklist.controller");
const { createAttendanceTable } = require("./src/models/attendance.model");
const { createAdvanceTable } = require("./src/models/advance.model");
const {
  createExpenseMasterTable,
  createExpenseDaysTable,
} = require("./src/models/expense.model");
const {
  createOnboardingMasterTable,
} = require("./src/models/onboarding.model");
const { createInterviewTable } = require("./src/models/interviews.model");
const { seedFullIMSData } = require("./src/models/masterIMS.model");
const {
  createInventoryTables,
} = require("./src/models/createIMSInventoryTables.model");
const { createO2DTables } = require("./src/models/o2d.model");
const { createScoreTable } = require("./src/models/score.model");

const onboardingRoutes = require("./src/routes/onboarding.routes");
const authRoutes = require("./src/routes/auth.routes");
const delegationRoutes = require("./src/routes/delegation.routes");
const employeeRoutes = require("./src/routes/employee.routes");
const checklistRoutes = require("./src/routes/checklist.routes");
const helpTicketRoutes = require("./src/routes/helpTicket.routes");
const todoRoutes = require("./src/routes/todo.routes");
const helpTicketConfigRoutes = require("./src/routes/helpTicketConfig.routes");
const attendanceRoutes = require("./src/routes/attendance.routes");
const advancePayments = require("./src/routes/advance.routes");
const expenses = require("./src/routes/expense.routes");
const interviews = require("./src/routes/interview.routes");
const imsInventory = require("./src/routes/imsInventory.routes");
const O2D = require("./src/routes/o2d.routes");
const scoreRoutes = require("./src/routes/score.routes");
const dashboardRoutes = require("./src/routes/dashboard.routes");

// Routes registration
app.use("/api/auth", authRoutes);
app.use("/api/delegations", delegationRoutes);
app.use("/api/master", employeeRoutes);
app.use("/api/checklist", checklistRoutes);
app.use("/api/help-tickets", helpTicketRoutes);
app.use("/api/todos", todoRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/advance", advancePayments);
app.use("/api/help-ticket-config", helpTicketConfigRoutes);
app.use("/api/expenses", expenses);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/interviews", interviews);
app.use("/api/ims", imsInventory);
app.use("/api/o2d", O2D);
app.use("/api/score", scoreRoutes);
app.use("/api/dashboard", dashboardRoutes);
// const fs = require('fs');
// if (fs.existsSync('uploads')) {
//     app.use('/uploads', express.static('uploads'));
// }

// Initialize Database Tables
Promise.all([
  createEmployeeTable(),
  createDelegationTables(),
  createDepartmentTable(),
  createChecklistTables(),
  createHelpTicketTables(),
  createTodoTables(),
  createHelpTicketConfigTable(),
  createLocationTable(),
  createAttendanceTable(),
  createAdvanceTable(),
  createExpenseMasterTable(),
  createExpenseDaysTable(),
  createOnboardingMasterTable(),
  createInterviewTable(),
  seedFullIMSData(),
  createInventoryTables(),
  createO2DTables(),
  createScoreTable(),
])
  .then(() => {
    console.log("Database synchronization complete");
    startChecklistCron(); // Start the daily task generation cron
  })
  .catch((err) => console.error("Database synchronization failed:", err));

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
