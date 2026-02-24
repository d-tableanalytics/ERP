const { pool } = require("../config/db.config");
const { uploadToDrive } = require("../utils/googleDrive");

exports.createTransaction = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      user_id,
      transaction_type,
      vendor_name,
      client_name,
      job_no,
      invoice_no,
      transaction_date,
      remarks,
    } = req.body;

    // ✅ Parse items properly
    const items = JSON.parse(req.body.items);

    // ✅ Get all uploaded files
    const files = req.files || [];

    const master = await client.query(
      `INSERT INTO inventory_transaction_master
      (user_id, transaction_type, vendor_name, client_name,
       job_no, invoice_no, transaction_date, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        user_id,
        transaction_type,
        vendor_name,
        client_name,
        job_no,
        invoice_no,
        transaction_date,
        remarks,
      ],
    );

    const transactionId = master.rows[0].id;

    /* ========= LOOP ITEMS ========= */

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // 🔥 match correct file with item index
      const file = files.find((f) => f.fieldname === `product_image_${i}`);

      let product_url = null;

      if (file) {
        product_url = await uploadToDrive(
          file.buffer,
          file.originalname,
          file.mimetype,
        );
      }

      /* ========= STOCK ========= */

      const stock = await client.query(
        "SELECT total_qty FROM stock_master WHERE product=$1",
        [item.product],
      );

      let currentQty = stock.rows.length ? Number(stock.rows[0].total_qty) : 0;

      let newQty =
        transaction_type === "IN"
          ? currentQty + Number(item.qty)
          : currentQty - Number(item.qty);

      if (newQty < 0) throw new Error("Insufficient Stock");

      /* ========= INSERT ITEM ========= */

      await client.query(
        `
        INSERT INTO inventory_transaction_items
        (transaction_id, product, product_url, description, moc, grade,
         size1, size2, class_sch, sch2, less_thk,
         qty_in, qty_out, unit, location, rack_no, available_qty)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      `,
        [
          transactionId,
          item.product,
          product_url, // ✅ correct variable
          item.description,
          item.moc,
          item.grade,
          item.size1,
          item.size2,
          item.class_sch,
          item.sch2,
          item.less_thk,
          transaction_type === "IN" ? item.qty : 0,
          transaction_type === "OUT" ? item.qty : 0,
          item.unit,
          item.location,
          item.rack_no,
          newQty,
        ],
      );

      await client.query(
        `
        INSERT INTO stock_master (product,total_qty)
        VALUES ($1,$2)
        ON CONFLICT (product)
        DO UPDATE SET total_qty=$2
      `,
        [item.product, newQty],
      );
    }

    await client.query("COMMIT");

    const createdTransaction = await pool.query(
      `
  SELECT 
    m.*,
    json_agg(i.*) AS items
  FROM inventory_transaction_master m
  LEFT JOIN inventory_transaction_items i
    ON m.id = i.transaction_id
  WHERE m.id = $1
  GROUP BY m.id
`,
      [transactionId],
    );

    res.status(201).json({
      success: true,
      message: "Transaction Created Successfully",
      transaction: createdTransaction.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

exports.editTransaction = async (req, res) => {
  const client = await pool.connect();
  const { id } = req.params;

  try {
    const {
      user_id,
      transaction_type,
      vendor_name,
      client_name,
      job_no,
      invoice_no,
      transaction_date,
      remarks,
    } = req.body;

    // ✅ Parse items properly (sent as JSON string in FormData)
    const items = JSON.parse(req.body.items);

    // ✅ Get all uploaded files
    const files = req.files || [];

    await client.query("BEGIN");

    /* ================= 1️⃣ GET OLD ITEMS ================= */
    const oldItems = await client.query(
      "SELECT * FROM inventory_transaction_items WHERE transaction_id=$1",
      [id],
    );

    /* ================= 2️⃣ REVERSE OLD STOCK ================= */
    for (const oldItem of oldItems.rows) {
      const stock = await client.query(
        "SELECT total_qty FROM stock_master WHERE product=$1",
        [oldItem.product],
      );

      let stockQty = Number(stock.rows[0].total_qty);

      // reverse logic
      stockQty += oldItem.qty_out;
      stockQty -= oldItem.qty_in;

      await client.query(
        "UPDATE stock_master SET total_qty=$1 WHERE product=$2",
        [stockQty, oldItem.product],
      );
    }

    /* ================= 3️⃣ DELETE OLD ITEMS ================= */
    await client.query(
      "DELETE FROM inventory_transaction_items WHERE transaction_id=$1",
      [id],
    );

    /* ================= 4️⃣ UPDATE MASTER ================= */
    await client.query(
      `
      UPDATE inventory_transaction_master
      SET user_id=$1,
          transaction_type=$2,
          vendor_name=$3,
          client_name=$4,
          job_no=$5,
          invoice_no=$6,
          transaction_date=$7,
          remarks=$8
      WHERE id=$9
    `,
      [
        user_id,
        transaction_type,
        vendor_name,
        client_name,
        job_no,
        invoice_no,
        transaction_date,
        remarks,
        id,
      ],
    );

    /* ================= 5️⃣ INSERT NEW ITEMS + UPDATE STOCK ================= */
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // 🔥 match correct file with item index
      const file = files.find((f) => f.fieldname === `product_image_${i}`);

      let product_url = item.product_url || null; // keep old url if exists

      if (file) {
        product_url = await uploadToDrive(
          file.buffer,
          file.originalname,
          file.mimetype,
        );
      }

      const stock = await client.query(
        "SELECT total_qty FROM stock_master WHERE product=$1",
        [item.product],
      );

      let currentQty = stock.rows.length ? Number(stock.rows[0].total_qty) : 0;

      let newQty =
        transaction_type === "IN"
          ? currentQty + Number(item.qty)
          : currentQty - Number(item.qty);

      if (newQty < 0) throw new Error("Insufficient Stock");

      await client.query(
        `
        INSERT INTO inventory_transaction_items
        (transaction_id, product, product_url, description, moc, grade,
         size1, size2, class_sch, sch2, less_thk,
         qty_in, qty_out, unit, location, rack_no, available_qty)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      `,
        [
          id,
          item.product,
          product_url,
          item.description,
          item.moc,
          item.grade,
          item.size1,
          item.size2,
          item.class_sch,
          item.sch2,
          item.less_thk,
          transaction_type === "IN" ? item.qty : 0,
          transaction_type === "OUT" ? item.qty : 0,
          item.unit,
          item.location,
          item.rack_no,
          newQty,
        ],
      );

      await client.query(
        `
        INSERT INTO stock_master (product,total_qty)
        VALUES ($1,$2)
        ON CONFLICT (product)
        DO UPDATE SET total_qty=$2
      `,
        [item.product, newQty],
      );
    }

    await client.query("COMMIT");

    const updatedTransaction = await pool.query(
      `
      SELECT m.*, json_agg(i.*) AS items
      FROM inventory_transaction_master m
      LEFT JOIN inventory_transaction_items i
      ON m.id = i.transaction_id
      WHERE m.id = $1
      GROUP BY m.id
    `,
      [id],
    );

    res.status(200).json({
      success: true,
      message: "✅ Transaction Updated Successfully",
      transaction: updatedTransaction.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

exports.getAllTransactions = async (req, res) => {
  const result = await pool.query(`
    SELECT m.*, json_agg(i.*) AS items
    FROM inventory_transaction_master m
    LEFT JOIN inventory_transaction_items i
    ON m.id = i.transaction_id
    GROUP BY m.id
    ORDER BY m.created_at DESC
  `);

  res.json(result.rows);
};

exports.deleteTransaction = async (req, res) => {
  const client = await pool.connect();
  const { id } = req.params;

  try {
    await client.query("BEGIN");

    const items = await client.query(
      "SELECT * FROM inventory_transaction_items WHERE transaction_id=$1",
      [id],
    );

    for (const item of items.rows) {
      const stock = await client.query(
        "SELECT total_qty FROM stock_master WHERE product=$1",
        [item.product],
      );

      let stockQty = Number(stock.rows[0].total_qty);

      stockQty += item.qty_out;
      stockQty -= item.qty_in;

      await client.query(
        "UPDATE stock_master SET total_qty=$1 WHERE product=$2",
        [stockQty, item.product],
      );
    }

    await client.query("DELETE FROM inventory_transaction_master WHERE id=$1", [
      id,
    ]);

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Transaction Deleted + Stock Reversed",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

exports.getAllMasters = async (req, res) => {
  try {
    const products = await pool.query(
      "SELECT * FROM product_master ORDER BY product_name",
    );
    const units = await pool.query(
      "SELECT * FROM unit_master ORDER BY unit_name",
    );
    const locations = await pool.query(
      "SELECT * FROM location_master ORDER BY location_name",
    );
    const racks = await pool.query(
      "SELECT * FROM rack_master ORDER BY rack_no",
    );
    const materials = await pool.query(
      "SELECT * FROM material_master ORDER BY category",
    );
    const size1 = await pool.query(
      "SELECT * FROM size1_master ORDER BY size_value",
    );

    const size2 = await pool.query(
      "SELECT * FROM size2_master ORDER BY size_value",
    );
    const descriptions = await pool.query(
      "SELECT * FROM description_master ORDER BY product_name, description_name",
    );
    const grades = await pool.query(
      "SELECT * FROM grade_master ORDER BY material_type, grade_name",
    );
    const classSch = await pool.query(
      "SELECT * FROM class_sch_master ORDER BY product_name, class_value",
    );

    const additionalDetails = await pool.query(
      "SELECT * FROM additional_detail_master ORDER BY detail_name",
    );
    res.json({
      products: products.rows,
      units: units.rows,
      locations: locations.rows,
      racks: racks.rows,
      materials: materials.rows,
      size1: size1.rows,
      size2: size2.rows,
      descriptions: descriptions.rows,
      grades: grades.rows,
      class_sch: classSch.rows,
      additional_details: additionalDetails.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
