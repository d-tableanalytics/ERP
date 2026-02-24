const { pool } = require("../config/db.config");
const { uploadToDrive } = require("../utils/googleDrive");

/**
 * POST /interviews
 * Create Interview Candidate (HR/Admin)
 */
exports.createInterview = async (req, res) => {
  try {
    const {
      full_name,
      email,
      mobile_no,
      current_location,
      highest_qualification,
      willing_to_relocate,
      work_status,
      applied_role,
      joining_time,
      own_laptop,
      remark,
      marital_status,
      total_experience_years,
      relevant_experience,
      previous_company,
      current_ctc_lpa,
      net_take_home_monthly,
      notice_period,
      previous_employment_details,
      document_list,
      expected_salary_monthly,
    } = req.body;

    // ✅ Resume Upload
    let resume_url = null;

    if (req.file) {
      resume_url = await uploadToDrive(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
    }

    const query = `
      INSERT INTO interviews (
        full_name, email, mobile_no, current_location,
        highest_qualification, willing_to_relocate,
        work_status, applied_role, joining_time,
        own_laptop, remark, marital_status,
        resume_url,
        total_experience_years, relevant_experience,
        previous_company,
        current_ctc_lpa, net_take_home_monthly,
        notice_period, previous_employment_details,
        document_list, expected_salary_monthly
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,
        $19,$20,$21,$22
      )
      RETURNING *
    `;

    const result = await pool.query(query, [
      full_name,
      email,
      mobile_no,
      current_location,
      highest_qualification,
      willing_to_relocate,
      work_status,
      applied_role,
      joining_time,
      own_laptop,
      remark,
      marital_status,
      resume_url,
      total_experience_years,
      relevant_experience,
      previous_company,
      current_ctc_lpa,
      net_take_home_monthly,
      notice_period,
      previous_employment_details,
      document_list || [],
      expected_salary_monthly,
    ]);

    res.status(201).json({
      message: "Interview candidate added successfully",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("Create Interview Error:", err);
    res.status(500).json({ message: "Error creating interview record" });
  }
};


/**
 * GET /interviews
 * List all candidates
 */
exports.getInterviewList = async (req, res) => {
  try {
    const query = `
      SELECT *
      FROM interviews
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching interviews" });
  }
};


/**
 * GET /interviews/:id
 */
exports.getInterviewDetail = async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `SELECT * FROM interviews WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Candidate not found" });
  }

  res.json({ success: true, data: result.rows[0] });
};


/**
 * PATCH /interviews/status/:id
 */
exports.updateInterviewStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const result = await pool.query(
    `
    UPDATE interviews
    SET status = $2
    WHERE id = $1
    RETURNING *
    `,
    [id, status]
  );

  res.json({
    message: "Status updated successfully",
    data: result.rows[0],
  });
};
