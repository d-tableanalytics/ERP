const express = require("express");
const router = express.Router();

const expenseController = require("../controllers/expense.controller");
const { verifyToken , authorize} = require('../middlewares/auth.middleware');

// Create Expense
router.post("/", verifyToken, expenseController.createExpense);

// List Expenses
router.get("/", verifyToken, expenseController.getExpenseList);

// Summary
router.get("/:id/summary", verifyToken, expenseController.getExpenseSummary);

//ExpenseDetail
router.get("/:id", verifyToken, expenseController.getExpenseDetail);

// Approve / Reject (Admin/HR only)
router.patch(
  "/approve/:id",
  verifyToken,
  authorize("SuperAdmin","Admin", "HR"),
  expenseController.approveExpense
);


router.patch(
  "/reject/:id",
  verifyToken,
  authorize("SuperAdmin","Admin", "HR"),
  expenseController.rejectExpense
);

module.exports = router;
