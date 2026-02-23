const { pool } = require("../config/db.config");

const createInventoryTables = async () => {

  /* ================= MASTER ================= */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_transaction_master (
      id SERIAL PRIMARY KEY,

      user_id INTEGER NOT NULL,
      transaction_type VARCHAR(10) CHECK (transaction_type IN ('IN','OUT')),

      vendor_name VARCHAR(150),
      client_name VARCHAR(150),

      job_no VARCHAR(100),
      invoice_no VARCHAR(150),

      remarks TEXT,

      transaction_date DATE NOT NULL,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  /* ================= ITEMS ================= */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_transaction_items (
      id SERIAL PRIMARY KEY,

      transaction_id INTEGER REFERENCES inventory_transaction_master(id) ON DELETE CASCADE,

      product VARCHAR(150) NOT NULL,
      product_url TEXT,  
      description TEXT,

      moc VARCHAR(100),
      grade VARCHAR(100),

      size1 VARCHAR(50),
      size2 VARCHAR(50),

      class_sch VARCHAR(100),
      sch2 VARCHAR(100),

      less_thk VARCHAR(100),

      qty_in NUMERIC(12,2) DEFAULT 0,
      qty_out NUMERIC(12,2) DEFAULT 0,

      unit VARCHAR(50),

      location VARCHAR(100),
      rack_no VARCHAR(50),

      available_qty NUMERIC(12,2) DEFAULT 0,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  /* ================= STOCK ================= */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_master (
      id SERIAL PRIMARY KEY,
      product VARCHAR(150) UNIQUE NOT NULL,
      total_qty NUMERIC(12,2) DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("✅ Inventory Tables Created");
};

module.exports = { createInventoryTables };