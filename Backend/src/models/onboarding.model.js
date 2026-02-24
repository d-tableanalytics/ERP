const { pool } = require("../config/db.config");

const createOnboardingMasterTable = async () => {
  const queryText = `
    CREATE TABLE IF NOT EXISTS onboarding_master (
        id SERIAL PRIMARY KEY,

        user_id INTEGER NOT NULL,

        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        contact VARCHAR(20) NOT NULL,

        role VARCHAR(50) NOT NULL,

        joining_docs TEXT[],

        checklist JSONB DEFAULT '[]',

        status VARCHAR(50) DEFAULT 'Pending',

        rejection_reason TEXT,
        approved_by INTEGER,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT fk_onboarding_user
          FOREIGN KEY (user_id)
          REFERENCES employees(user_id)
          ON DELETE CASCADE
    );
  `;

  try {
    await pool.query(queryText);
    console.log("Onboarding Master table ensured in database");
  } catch (err) {
    console.error("Error creating onboarding_master table:", err);
    throw err;
  }
};

module.exports = {
  createOnboardingMasterTable,
};
