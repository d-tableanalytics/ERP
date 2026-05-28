const { pool } = require("../config/db.config");
const { O2D_STEPS } = require("../services/o2d.service");

const createO2DTables = async () => {

  /* ================= ORDERS ================= */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS o2d_orders (
      id SERIAL PRIMARY KEY,
      po_number VARCHAR(100),
      firm_name VARCHAR(255),
      buyer_name VARCHAR(255),
      uid VARCHAR(100),
      delivery_date DATE,
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

  await pool.query(`ALTER TABLE o2d_orders ADD COLUMN IF NOT EXISTS po_number VARCHAR(100);`);
  await pool.query(`ALTER TABLE o2d_orders ADD COLUMN IF NOT EXISTS firm_name VARCHAR(255);`);
  await pool.query(`ALTER TABLE o2d_orders ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(255);`);
  await pool.query(`ALTER TABLE o2d_orders ADD COLUMN IF NOT EXISTS uid VARCHAR(100);`);
  await pool.query(`ALTER TABLE o2d_orders ADD COLUMN IF NOT EXISTS delivery_date DATE;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_o2d_orders_po_number ON o2d_orders (po_number);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_o2d_orders_delivery_date ON o2d_orders (delivery_date);`);

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS o2d_step_history (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES o2d_orders(id) ON DELETE CASCADE,
      po_number VARCHAR(100),
      from_step VARCHAR(255),
      to_step VARCHAR(255),
      changed_by INTEGER,
      remarks TEXT,
      changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`ALTER TABLE o2d_step_history ADD COLUMN IF NOT EXISTS po_number VARCHAR(100);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS o2d_order_remarks (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES o2d_orders(id) ON DELETE CASCADE,
      remark TEXT NOT NULL,
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log(`O2D Tables Ready (${O2D_STEPS.length} workflow steps)`);
};

module.exports = { createO2DTables };
