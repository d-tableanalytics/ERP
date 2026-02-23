const { pool } = require("../config/db.config");
const { uploadToDrive } = require("../utils/googleDrive");

/**
 * POST /onboarding
 * Create Onboarding Request + Upload Docs
 */
exports.createOnboarding = async (req, res) => {
  const { name, email, contact, role, checklist } = req.body;

  const user_id = req.user.user_id;

  if (!name || !email || !contact || !role) {
    return res.status(400).json({
      message: "Name, Email, Contact and Role are required",
    });
  }

  try {
    await pool.query("BEGIN");

    // ✅ Upload Joining Docs
    let joining_docs = [];

    if (req.files && req.files["joining_docs"]) {
      joining_docs = await Promise.all(
        req.files["joining_docs"].map(async (file, index) => {
          try {
            return await uploadToDrive(
              file.buffer,
              file.originalname,
              file.mimetype
            );
          } catch (uploadError) {
            console.warn(`Doc ${index} upload failed`, uploadError);
            return null;
          }
        })
      );
    }

    joining_docs = joining_docs.filter((url) => url !== null);

    // ✅ Insert Onboarding Record
    const query = `
      INSERT INTO onboarding_master
      (user_id, name, email, contact, role, joining_docs, checklist)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `;

    const result = await pool.query(query, [
      user_id,
      name,
      email,
      contact,
      role,
      joining_docs,
      checklist || [],
    ]);

    await pool.query("COMMIT");

    res.status(201).json({
      message: "Onboarding Request Created Successfully ✅",
      data: result.rows[0],
    });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Onboarding Create Error:", err);

    res.status(500).json({
      message: "Error creating onboarding request",
    });
  }
};

/**
 * GET /onboarding
 * Role Based Onboarding List
 */
exports.getOnboardingList = async (req, res) => {
  try {
    const { user_id, role } = req.user;

    let query = `
      SELECT 
        om.*,
        e.first_name,
        e.last_name,
        e.work_email
      FROM onboarding_master om
      JOIN employees e
        ON om.user_id = e.user_id
    `;

    const values = [];

    // 👤 Employee → only own onboarding
    if (!["Admin", "HR"].includes(role)) {
      query += ` WHERE om.user_id = $1`;
      values.push(user_id);
    }

    query += ` ORDER BY om.created_at DESC`;

    const result = await pool.query(query, values);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (err) {
    console.error("Get Onboarding Error:", err);
    res.status(500).json({
      message: "Error fetching onboarding list",
    });
  }
};

/**
 * PATCH /onboarding/approve/:id
 * Approve Request (HR/Admin)
 */
exports.approveOnboarding = async (req, res) => {
  const { id } = req.params;

  const approverId = req.user.user_id;

  try {
    const query = `
      UPDATE onboarding_master
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
        message: "Request not found or already processed",
      });
    }

    res.json({
      message: "Onboarding Approved Successfully ✅",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("Approve Onboarding Error:", err);
    res.status(500).json({
      message: "Error approving onboarding",
    });
  }
};

/**
 * PATCH /onboarding/reject/:id
 * Reject Request (HR/Admin)
 */
exports.rejectOnboarding = async (req, res) => {
  const { id } = req.params;
  const { rejection_reason } = req.body;

  if (!rejection_reason) {
    return res.status(400).json({
      message: "Rejection reason is required",
    });
  }

  try {
    const query = `
      UPDATE onboarding_master
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
        message: "Request not found or already processed",
      });
    }

    res.json({
      message: "Onboarding Rejected Successfully ❌",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("Reject Onboarding Error:", err);
    res.status(500).json({
      message: "Error rejecting onboarding",
    });
  }
};
