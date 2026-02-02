const { pool } = require("../config/db.config");

/**
 * POST /advance
 * Create new advance request
 */
exports.createAdvanceRequest = async (req, res) => {
  const {
    user_id,
    department,
    required_amount,
    reason,
    date_needed,
    repayment_period,
  } = req.body;

  if (
    !user_id ||
    !required_amount ||
    !reason ||
    !date_needed ||
    !repayment_period
  ) {
    return res.status(400).json({
      message: "Missing required fields",
    });
  }

  try {
    const query = `
            INSERT INTO advance_applications (
                user_id,
                department,
                required_amount,
                reason,
                date_needed,
                repayment_period
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;

    const result = await pool.query(query, [
      user_id,
      department,
      required_amount,
      reason,
      date_needed,
      repayment_period,
    ]);

    res.status(201).json({
      message: "Advance request submitted successfully",
      data: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error creating advance request",
    });
  }
};

// only admin can see this
exports.getAdvanceList = async (req, res) => {
  try {
    const { user_id, role } = req.user;

    let query = `
            SELECT
                a.id,
                a.required_amount,
                a.reason,
                a.date_needed,
                a.repayment_period,
                a.status,
                a.applied_at,

                e.user_id,
                e.first_name,
                e.last_name,
                e.work_email,
                e.department
            FROM advance_applications a
            JOIN employees e
              ON a.user_id = e.user_id
        `;

    const values = [];

    if (!["Admin", "HR"].includes(role)) {
      query += ` WHERE a.user_id = $1`;
      values.push(user_id);
    }

    query += ` ORDER BY a.applied_at DESC`;

    const result = await pool.query(query, values);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching advance list" });
  }
};

/**
 * GET /advance?user_id=1 this for user
 */
exports.getAdvanceByUser = async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ message: "user_id is required" });
  }

  try {
    const query = `
            SELECT *
            FROM advance_applications
            WHERE user_id = $1
            ORDER BY applied_at DESC
        `;

    const result = await pool.query(query, [user_id]);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching user advances" });
  }
};

/**
 * PATCH /advance/approve/:id
 */
 exports.approveAdvance = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
            UPDATE advance_applications
            SET status = 'Approved'
            WHERE id = $1
              AND status = 'Pending'
            RETURNING *
        `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(400).json({
        message: "Advance not found or already processed",
      });
    }

    res.json({
      message: "Advance approved successfully",
      data: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error approving advance",
    });
  }
};

/**
 * PATCH /advance/reject/:id
 */
exports.rejectAdvance = async (req, res) => {
  const { id } = req.params;
  const { rejection_reason } = req.body;

  try {
    const query = `
            UPDATE advance_applications
            SET 
                status = 'Rejected',
                rejection_reason = $2
            WHERE id = $1
              AND status = 'Pending'
            RETURNING *
        `;

    const result = await pool.query(query, [id, rejection_reason || null]);

    if (result.rows.length === 0) {
      return res.status(400).json({
        message: "Advance not found or already processed",
      });
    }

    res.json({
      message: "Advance rejected successfully",
      data: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error rejecting advance",
    });
  }
};
