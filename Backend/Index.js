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
const { createDelegationExtrasTables } = require("./src/models/delegationExtras.model");
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
const { createChatbotConversationsTable } = require("./src/models/chatbot.model");

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
const categoryRoutes = require("./src/routes/category.routes");
const tagRoutes = require("./src/routes/tag.routes");
const holidayRoutes = require("./src/routes/holiday.routes");
const notificationRoutes = require("./src/routes/notification.routes");
const notificationPrefRoutes = require("./src/routes/notificationPreference.routes");

// Chatbot Routes
const chatbotRoutes = require("./src/modules/chatbot/chatbot.routes");

// New Task Routes
const taskRoutes = require("./src/routes/task.routes");

// Routes registration
app.use("/api/auth", authRoutes);
app.use("/api/delegations", delegationRoutes);
app.use("/api/tasks", taskRoutes);
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
app.use("/api/categories", categoryRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/notification-settings", notificationPrefRoutes);
app.use("/api/chatbot", chatbotRoutes);

// Initialize Database Tables and start server
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
  createChatbotConversationsTable(),
  createDelegationExtrasTables(),
])
  .then(() => {
    console.log("Database synchronization complete");
    startChecklistCron();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database synchronization failed:", err);
    process.exit(1);
  });

module.exports = app;