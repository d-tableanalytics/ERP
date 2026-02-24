const { pool } = require("../config/db.config");

const seedFullIMSData = async () => {
  const client = await pool.connect();

  try {
    console.log("🌱 Creating Tables + Seeding Dummy Data...");
    await client.query("BEGIN");

    /* ================= CREATE TABLES ================= */

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_master (
        id SERIAL PRIMARY KEY,
        product_name VARCHAR(150) UNIQUE NOT NULL,
        product_url TEXT,  
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS unit_master (
        id SERIAL PRIMARY KEY,
        unit_name VARCHAR(50) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS location_master (
        id SERIAL PRIMARY KEY,
        location_name VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS rack_master (
        id SERIAL PRIMARY KEY,
        rack_no VARCHAR(50) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS material_master (
        id SERIAL PRIMARY KEY,
        category VARCHAR(100),
        material_name VARCHAR(150),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (category, material_name)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS grade_master (
        id SERIAL PRIMARY KEY,
        material_type VARCHAR(100),
        grade_name VARCHAR(150),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (material_type, grade_name)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS size1_master (
        id SERIAL PRIMARY KEY,
        size_value VARCHAR(50) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS size2_master (
        id SERIAL PRIMARY KEY,
        size_value VARCHAR(50) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS description_master (
        id SERIAL PRIMARY KEY,
        product_name VARCHAR(150),
        description_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (product_name, description_name)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS class_sch_master (
        id SERIAL PRIMARY KEY,
        product_name VARCHAR(100),
        class_value VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (product_name, class_value)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS additional_detail_master (
        id SERIAL PRIMARY KEY,
        detail_name VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    /* ================= INSERT 5 RECORDS EACH ================= */

    await client.query(`
      INSERT INTO product_master (product_name)
      VALUES ('Pipe'), ('Flanges'), ('Elbow'), ('Tee'), ('Fasteners')
      ON CONFLICT DO NOTHING;
    `);

    await client.query(`
      INSERT INTO unit_master (unit_name)
      VALUES ('nos'), ('kg'), ('pcs'), ('meter'), ('feet')
      ON CONFLICT DO NOTHING;
    `);

    await client.query(`
      INSERT INTO location_master (location_name)
      VALUES ('Warehouse'), ('Rack Area'), ('Open Yard'), ('Site A'), ('Site B')
      ON CONFLICT DO NOTHING;
    `);

    await client.query(`
      INSERT INTO rack_master (rack_no)
      VALUES ('R1'), ('R2'), ('R3'), ('R4'), ('R5')
      ON CONFLICT DO NOTHING;
    `);

    await client.query(`
      INSERT INTO material_master (category, material_name)
      VALUES
      ('SS','SS 304'),
      ('SS','SS 316'),
      ('CS','A105'),
      ('Duplex','S 2507'),
      ('Nickel','Inconel 625')
      ON CONFLICT DO NOTHING;
    `);

    await client.query(`
      INSERT INTO grade_master (material_type, grade_name)
      VALUES
      ('SS','SS 304'),
      ('SS','SS 316'),
      ('CS','A105'),
      ('Duplex','S 32205'),
      ('Nickel','Inconel 625')
      ON CONFLICT DO NOTHING;
    `);

    await client.query(`
      INSERT INTO size1_master (size_value)
      VALUES ('1/4"'), ('3/8"'), ('1/2"'), ('3/4"'), ('1"')
      ON CONFLICT DO NOTHING;
    `);

    await client.query(`
      INSERT INTO size2_master (size_value)
      VALUES ('1"'), ('2"'), ('3"'), ('4"'), ('6"')
      ON CONFLICT DO NOTHING;
    `);

    await client.query(`
      INSERT INTO description_master (product_name, description_name)
      VALUES
      ('Flanges','Slipon'),
      ('Flanges','WNRF'),
      ('Pipe','ERW'),
      ('Pipe','SMLS'),
      ('Fasteners','Hex Bolt')
      ON CONFLICT DO NOTHING;
    `);

    await client.query(`
      INSERT INTO class_sch_master (product_name, class_value)
      VALUES
      ('Flanges','#150'),
      ('Flanges','#300'),
      ('Pipe','Sch. 40'),
      ('Pipe','Sch. 80'),
      ('Pipe','Sch. XS')
      ON CONFLICT DO NOTHING;
    `);

    await client.query(`
      INSERT INTO additional_detail_master (detail_name)
      VALUES ('NPT(M)'), ('NPT(F)'), ('BSP(M)'), ('BSP(F)'), ('NPT')
      ON CONFLICT DO NOTHING;
    `);

    await client.query("COMMIT");
   
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seed Error:", err.message);
  } finally {
    client.release();
  }
};

module.exports = { seedFullIMSData };