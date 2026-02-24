const { pool } = require("../config/db.config");

const createInterviewTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS interviews (
      id SERIAL PRIMARY KEY,

      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(120) NOT NULL,
      mobile_no VARCHAR(20),

      current_location VARCHAR(100),

      highest_qualification VARCHAR(100),
      willing_to_relocate BOOLEAN DEFAULT false,

      work_status VARCHAR(50), -- Fresher / Working / Notice Period
      applied_role VARCHAR(100),

      joining_time VARCHAR(100), -- "Immediate", "15 days", etc.

      own_laptop BOOLEAN DEFAULT false,

      remark TEXT,
      marital_status VARCHAR(30),

      resume_url TEXT,

      total_experience_years NUMERIC(4,1),
      relevant_experience TEXT, -- "1 year 6 months"

      previous_company VARCHAR(150),

      current_ctc_lpa NUMERIC(10,2),
      net_take_home_monthly NUMERIC(10,2),

      notice_period VARCHAR(50),

      previous_employment_details BOOLEAN DEFAULT false,

      document_list TEXT[], -- ["Aadhar", "PAN", "Offer Letter"]

      expected_salary_monthly NUMERIC(10,2),

      status VARCHAR(30) DEFAULT 'Pending', -- Pending/Selected/Rejected

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await pool.query(query);
  console.log("Interview table created successfully");
};

module.exports = { createInterviewTable };
