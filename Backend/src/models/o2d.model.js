const { pool } = require("../config/db.config");

const createO2DTables = async () => {

  /* ================= ORDERS ================= */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS o2d_orders (
      id SERIAL PRIMARY KEY,
      party_name VARCHAR(255),
      customer_type VARCHAR(100),
      contact_no VARCHAR(20),
      alternate_no VARCHAR(20),
      email VARCHAR(255),
      location VARCHAR(255),
      state VARCHAR(100),
      representative VARCHAR(255),
      overall_status VARCHAR(50) DEFAULT 'IN_PROGRESS',
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  /* ================= ITEMS ================= */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS o2d_order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES o2d_orders(id) ON DELETE CASCADE,
      item_name VARCHAR(255),
      qty INTEGER
    );
  `);

  /* ================= STEPS ================= */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS o2d_order_steps (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES o2d_orders(id) ON DELETE CASCADE,

      step_number INTEGER,
      step_name VARCHAR(255),

      assigned_to INTEGER,
      assigned_by INTEGER,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      planned_date TIMESTAMP,
      actual_date TIMESTAMP,

      remarks TEXT,

      status VARCHAR(50)
      CHECK (status IN (
        'IN_PROGRESS',
        'COMPLETED',
        'REJECTED',
        'ON_HOLD'
      )),

      dependency_group INTEGER DEFAULT 1
    );
  `);

  console.log("O2D Tables Ready ✅");
};

module.exports = { createO2DTables };