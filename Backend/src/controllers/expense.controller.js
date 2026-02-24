const { pool } = require("../config/db.config");
const { uploadToDrive } = require('../utils/googleDrive');
/**
 * POST /expenses
 * Create Expense Master + Expense Days
 */
exports.createExpense = async (req, res) => {
  const { location, client, company, advance, start_date, end_date, days } =
    req.body;

  const user_id = req.user.user_id;

  if (!start_date || !end_date || !days || days.length === 0) {
    return res.status(400).json({
      message: "Start date, End date and Days expenses are required",
    });
  }

  try {
    await pool.query("BEGIN");

    // ✅ Upload Bills PDF
    let bill_pay_pdf = [];

    if (req.files && req.files["bill_pay_pdf"]) {
      bill_pay_pdf = await Promise.all(
        req.files["bill_pay_pdf"].map(async (file, index) => {
          try {
            return await uploadToDrive(
              file.buffer,
              file.originalname,
              file.mimetype
            );
          } catch (uploadError) {
            console.warn(`Bill PDF ${index} upload failed`, uploadError);
            return null;
          }
        })
      );
    }

    // Remove null values
    bill_pay_pdf = bill_pay_pdf.filter((url) => url !== null);

    // ✅ Total Calculation
    const totalAmount = days.reduce(
      (sum, d) => sum + Number(d.amount || 0),
      0
    );

    const netAmount = totalAmount - Number(advance || 0);

    // ✅ Insert Expense Master
    const masterQuery = `
      INSERT INTO expense_master
      (user_id, location, client, company, bill_pay_pdf,
       advance, total, net, start_date, end_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `;

    const masterResult = await pool.query(masterQuery, [
      user_id,
      location,
      client,
      company,
      bill_pay_pdf,
      advance || 0,
      totalAmount,
      netAmount,
      start_date,
      end_date,
    ]);

    const expenseMaster = masterResult.rows[0];

    // ✅ Insert Expense Days
    const dayQuery = `
      INSERT INTO expense_days
      (expense_id, day_no, description, amount, pdf_url)
      VALUES ($1,$2,$3,$4,$5)
    `;

    for (let day of days) {
      await pool.query(dayQuery, [
        expenseMaster.id,
        day.day_no,
        day.description,
        day.amount,
        day.pdf_url || null,
      ]);
    }

    await pool.query("COMMIT");

    res.status(201).json({
      message: "Expense created successfully",
      data: expenseMaster,
    });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Expense Create Error:", err);

    res.status(500).json({
      message: "Error creating expense",
    });
  }
};
/**
 * GET /expenses
 */
exports.getExpenseList = async (req, res) => {
  try {
    const { user_id, role } = req.user;

    let query = `
      SELECT
        em.*,
        e.first_name,
        e.last_name,
        e.work_email
      FROM expense_master em
      JOIN employees e
        ON em.user_id = e.user_id
    `;

    const values = [];

    // 👤 Employee → only own
    if (!["Admin", "HR"].includes(role)) {
      query += ` WHERE em.user_id = $1`;
      values.push(user_id);
    }

    query += ` ORDER BY em.created_at DESC`;

    const result = await pool.query(query, values);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching expenses" });
  }
};
/**
 * PATCH /expenses/approve/:id
 */

exports.approveExpense = async (req, res) => {
  const { id } = req.params;

  // Logged-in Admin/HR ID
  const approverId = req.user.user_id;

  try {
    const query = `
      UPDATE expense_master
      SET 
        status = 'Approved',
        approved_by = $2
      WHERE id = $1
        AND status = 'Pending'
      RETURNING *
    `;

    const result = await pool.query(query, [id, approverId]);

    if (result.rows.length === 0) {
      return res.status(400).json({
        message: "Expense not found or already processed",
      });
    }

    res.json({
      message: "Expense approved successfully",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("Approve Expense Error:", err);
    res.status(500).json({ message: "Error approving expense" });
  }
};


exports.getExpenseDetail = async (req, res) => {
  const { id } = req.params;

  try {
    // ✅ 1. Fetch Expense Master + Employee Info
    const masterQuery = `
      SELECT
        em.*,
        e.first_name,
        e.last_name,
        e.work_email,
        e.department,
        e.designation
      FROM expense_master em
      JOIN employees e
        ON em.user_id = e.user_id
      WHERE em.id = $1
    `;

    const masterResult = await pool.query(masterQuery, [id]);

    if (masterResult.rows.length === 0) {
      return res.status(404).json({
        message: "Expense record not found",
      });
    }

    const expenseMaster = masterResult.rows[0];

    // ✅ 2. Fetch Expense Days (D1, D2, D3...)
    const daysQuery = `
      SELECT
        id,
        day_no,
        description,
        amount,
        pdf_url,
        created_at
      FROM expense_days
      WHERE expense_id = $1
      ORDER BY day_no ASC
    `;

    const daysResult = await pool.query(daysQuery, [id]);

    // ✅ Final Response
    res.json({
      success: true,
      expense: expenseMaster,
      days: daysResult.rows,
    });
  } catch (err) {
    console.error("Error fetching expense detail:", err);
    res.status(500).json({
      message: "Error fetching expense detail",
    });
  }
};

/**
 * PATCH /expenses/reject/:id
 */
exports.rejectExpense = async (req, res) => {
  const { id } = req.params;
  const { rejection_reason } = req.body;

  if (!rejection_reason) {
    return res.status(400).json({
      message: "Rejection reason is required",
    });
  }

  try {
    const query = `
      UPDATE expense_master
      SET 
        status = 'Rejected',
        rejection_reason = $2
      WHERE id = $1
        AND status = 'Pending'
      RETURNING *
    `;

    const result = await pool.query(query, [id, rejection_reason]);

    if (result.rows.length === 0) {
      return res.status(400).json({
        message: "Expense not found or already processed",
      });
    }

    res.json({
      message: "Expense rejected successfully",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("Reject Expense Error:", err);
    res.status(500).json({ message: "Error rejecting expense" });
  }
};

/**
 * GET /expenses/:id/summary
 */
exports.getExpenseSummary = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT day_no,
             SUM(amount) AS total_amount
      FROM expense_days
      WHERE expense_id = $1
      GROUP BY day_no
      ORDER BY day_no ASC
    `;

    const result = await pool.query(query, [id]);

    const totalAmount = result.rows.reduce(
      (sum, row) => sum + Number(row.total_amount),
      0
    );

    res.json({
      expense_id: id,
      total_days: result.rows.length,
      total_amount: totalAmount,
      day_breakup: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching summary" });
  }
};
