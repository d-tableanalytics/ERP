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
const { createTaskTable } = require("./src/models/task.model");
const {
  createHelpTicketConfigTable,
} = require("./src/models/helpTicketConfig.model");
const {
  startChecklistCron,
} = require("./src/controllers/checklist.controller");
const {
  startTaskAutomationCron,
} = require("./src/utils/taskAutomation");
const { initReminderJob } = require("./src/jobs/reminderJob");
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
const { createNotificationsTable } = require("./src/models/notification.model");

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
async function initializeDatabase() {
  const initSteps = [
    { name: "Employees", fn: createEmployeeTable },
    { name: "Delegation", fn: createDelegationTables },
    { name: "Departments", fn: createDepartmentTable },
    { name: "Checklists", fn: createChecklistTables },
    { name: "Help Tickets", fn: createHelpTicketTables },
    { name: "Todos", fn: createTodoTables },
    { name: "Help Ticket Config", fn: createHelpTicketConfigTable },
    { name: "Locations", fn: createLocationTable },
    { name: "Attendance", fn: createAttendanceTable },
    { name: "Advance", fn: createAdvanceTable },
    { name: "Expense Master", fn: createExpenseMasterTable },
    { name: "Expense Days", fn: createExpenseDaysTable },
    { name: "Onboarding Master", fn: createOnboardingMasterTable },
    { name: "Interviews", fn: createInterviewTable },
    { name: "IMS Master Data", fn: seedFullIMSData },
    { name: "Inventory", fn: createInventoryTables },
    { name: "O2D Tables", fn: createO2DTables },
    { name: "Score Table", fn: createScoreTable },
    { name: "Chatbot Conversations", fn: createChatbotConversationsTable },
    { name: "Delegation Extras", fn: createDelegationExtrasTables },
    { name: "Tasks", fn: createTaskTable },
    { name: "Notifications", fn: createNotificationsTable },
  ];

  for (const step of initSteps) {
    try {
      // console.log(`Initializing ${step.name}...`);
      await step.fn();
    } catch (err) {
      console.error(`❌ Error initializing ${step.name}:`, err.message);
      // We continue with other tables even if one fails, unless it's critical
    }
  }

  console.log("Database synchronization complete");
  startChecklistCron();
  startTaskAutomationCron();
  initReminderJob();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

initializeDatabase().catch((err) => {
  console.error("Critical error during database initialization:", err);
  process.exit(1);
});

module.exports = app;