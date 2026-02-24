const { pool } = require("../config/db.config");

/* ================= DEFAULT WORKFLOW ================= */

const defaultSteps = [
  "Destination",
  "Check Stock Availability",
  "Promotion & Communication",
  "Warehouse Dispatch",
  "Transport Coordination",
  "Accounts Processing",
  "Costing",
  "Billing"
];

/* =====================================================
   CREATE ORDER
===================================================== */

exports.createO2DOrder = async (req, res) => {
  const client = await pool.connect();
  const user_id = req.user.user_id || req.user.id;

  const {
    party_name,
    customer_type,
    contact_no,
    alternate_no,
    email,
    location,
    state,
    representative,
    items
  } = req.body;

  try {
    await client.query("BEGIN");

    const orderResult = await client.query(
      `INSERT INTO o2d_orders
       (party_name, customer_type, contact_no, alternate_no,
        email, location, state, representative, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        party_name,
        customer_type,
        contact_no,
        alternate_no,
        email,
        location,
        state,
        representative,
        user_id
      ]
    );

    const order = orderResult.rows[0];

    /* Insert Items */
    if (items?.length) {
      for (let item of items) {
        await client.query(
          `INSERT INTO o2d_order_items
           (order_id, item_name, qty)
           VALUES ($1,$2,$3)`,
          [order.id, item.item_name, item.qty]
        );
      }
    }

    /* Insert Steps */
    for (let i = 0; i < defaultSteps.length; i++) {
      await client.query(
        `INSERT INTO o2d_order_steps
         (order_id, step_number, step_name, status)
         VALUES ($1,$2,$3,$4)`,
        [
          order.id,
          i + 1,
          defaultSteps[i],
          i === 0 ? "IN_PROGRESS" : null
        ]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: order
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Error creating order" });
  } finally {
    client.release();
  }
};

/* =====================================================
   GET ALL ORDERS WITH DETAILS
===================================================== */

exports.getAllO2DOrders = async (req, res) => {
  try {
    const orders = await pool.query(`
      SELECT * FROM o2d_orders
      ORDER BY created_at DESC
    `);

    const result = [];

    for (let order of orders.rows) {
      const items = await pool.query(
        `SELECT * FROM o2d_order_items WHERE order_id=$1`,
        [order.id]
      );

      const steps = await pool.query(
        `SELECT * FROM o2d_order_steps
         WHERE order_id=$1
         ORDER BY step_number ASC`,
        [order.id]
      );

      result.push({
        ...order,
        items: items.rows,
        steps: steps.rows
      });
    }

    res.json({ success: true, data: result });

  } catch (err) {
    res.status(500).json({ message: "Error fetching orders" });
  }
};

/* =====================================================
   ASSIGN STEP (Nested)
===================================================== */

exports.assignO2DStep = async (req, res) => {
  const { orderId, stepId } = req.params;
  const { assigned_to, planned_date } = req.body;
  const assigned_by = req.user.user_id || req.user.id;

  try {
    const result = await pool.query(
      `UPDATE o2d_order_steps
       SET assigned_to=$1,
           assigned_by=$2,
           assigned_at=NOW(),
           planned_date=$3
       WHERE id=$4
       AND order_id=$5
       AND (status IS NULL OR status='IN_PROGRESS')
       RETURNING *`,
      [assigned_to, assigned_by, planned_date, stepId, orderId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Step not found or already completed"
      });
    }

    res.json({
      success: true,
      message: "Step assigned successfully",
      data: result.rows[0]
    });

  } catch (err) {
    res.status(500).json({ message: "Error assigning step" });
  }
};

/* =====================================================
   COMPLETE STEP (Nested + Secure)
===================================================== */

exports.completeO2DStep = async (req, res) => {
  const client = await pool.connect();
  const { orderId, stepId } = req.params;
  const { remarks } = req.body;
  const user_id = req.user.user_id || req.user.id;

  try {
    await client.query("BEGIN");

    /* Validate Step */
    const stepCheck = await client.query(
      `SELECT * FROM o2d_order_steps
       WHERE id=$1
       AND order_id=$2
       AND assigned_to=$3
       AND status='IN_PROGRESS'`,
      [stepId, orderId, user_id]
    );

    if (!stepCheck.rows.length) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: "Not authorized or step not active"
      });
    }

    /* Complete Step */
    const stepUpdate = await client.query(
      `UPDATE o2d_order_steps
       SET status='COMPLETED',
           actual_date=NOW(),
           remarks=$3
       WHERE id=$1
       AND order_id=$2
       RETURNING *`,
      [stepId, orderId, remarks || null]
    );

    const { step_number } = stepUpdate.rows[0];

    /* Activate Next Step */
    await client.query(
      `UPDATE o2d_order_steps
       SET status='IN_PROGRESS'
       WHERE order_id=$1
       AND step_number=$2
       AND status IS NULL`,
      [orderId, step_number + 1]
    );

    /* Check If All Completed */
    const finalCheck = await client.query(
      `SELECT COUNT(*) FROM o2d_order_steps
       WHERE order_id=$1
       AND (status IS NULL OR status!='COMPLETED')`,
      [orderId]
    );

    if (Number(finalCheck.rows[0].count) === 0) {
      await client.query(
        `UPDATE o2d_orders
         SET overall_status='COMPLETED'
         WHERE id=$1`,
        [orderId]
      );
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Step completed successfully"
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: "Error completing step" });
  } finally {
    client.release();
  }
};