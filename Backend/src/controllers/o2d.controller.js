const { pool } = require("../config/db.config");
const o2dService = require("../services/o2d.service");

/* ================= DEFAULT WORKFLOW ================= */

const defaultSteps = o2dService.O2D_STEPS;

/* =====================================================
   CREATE ORDER
===================================================== */

exports.createO2DOrder = async (req, res) => {
  const client = await pool.connect();
  const user_id = req.user.user_id || req.user.id;

  const {
    party_name,
    po_number,
    firm_name,
    buyer_name,
    uid,
    delivery_date,
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
       (po_number, firm_name, buyer_name, uid, delivery_date,
        party_name, customer_type, contact_no, alternate_no,
        email, location, state, representative, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        po_number || null,
        firm_name || null,
        buyer_name || null,
        uid || null,
        delivery_date || null,
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
    res.status(500).json({ success: false, message: "Error creating order" });
  } finally {
    client.release();
  }
};

/* =====================================================
   GET ALL ORDERS WITH DETAILS
===================================================== */

exports.getAllO2DOrders = async (req, res) => {
  try {
    const result = await o2dService.getOrders(req.query || {}, req.user, {
      limit: req.query.limit || 50
    });

    res.json({ success: true, data: result });

  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching orders" });
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
      return res.status(400).json({
        success: false,
        message: "Step not found or already completed"
      });
    } 

    res.json({
      success: true,
      message: "Step assigned successfully",
      data: result.rows[0]
    });

  } catch (err) {
    res.status(500).json({ success: false, message: "Error assigning step" });
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
      return res.status(400).json({
        success: false,
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
      message: "Step completed successfully",
      data: stepUpdate.rows[0]
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ success: false, message: "Error completing step" });
  } finally {
    client.release();
  }
};

exports.getO2DOrderByPO = async (req, res) => {
  try {
    const order = await o2dService.getOrderByPO(req.params.poNumber, req.user);
    if (!order) {
      return res.status(404).json({ success: false, message: "O2D order not found" });
    }
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching O2D order" });
  }
};

exports.getO2DOrdersByStep = async (req, res) => {
  try {
    const result = await o2dService.getOrdersByStep(req.params.stepName, req.user, {
      limit: req.query.limit || 50
    });
    if (!result.ok) return res.status(400).json({ success: false, message: result.error });
    res.json({ success: true, data: result.orders, count: result.count, step: result.step });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching O2D step orders" });
  }
};

exports.getO2DOverdueOrders = async (req, res) => {
  try {
    const result = await o2dService.getOverdueOrders(req.user, { limit: req.query.limit || 50 });
    res.json({ success: true, data: result.orders, count: result.count });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching overdue O2D orders" });
  }
};

exports.getO2DSummary = async (req, res) => {
  try {
    const summary = await o2dService.getSummary(req.user);
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching O2D summary" });
  }
};

exports.updateO2DStep = async (req, res) => {
  try {
    const result = await o2dService.updateStep({
      orderId: req.params.orderId,
      ...req.body,
    }, req.user);
    if (!result.ok) return res.status(400).json({ success: false, message: result.error, data: result });
    res.json({ success: true, message: result.message, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error updating O2D step" });
  }
};

exports.correctO2DStep = async (req, res) => {
  try {
    const result = await o2dService.correctCurrentStep({
      orderId: req.params.orderId,
      poNumber: req.body.poNumber,
      toStep: req.body.toStep || req.body.currentStep,
      remarks: req.body.remarks,
    }, req.user);
    if (!result.ok) return res.status(400).json({ success: false, message: result.error, data: result });
    res.json({ success: true, message: result.message, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error correcting O2D step" });
  }
};

exports.addO2DRemark = async (req, res) => {
  try {
    const result = await o2dService.addRemark({
      orderId: req.params.orderId,
      remark: req.body.remark || req.body.remarks,
    }, req.user);
    if (!result.ok) return res.status(400).json({ success: false, message: result.error });
    res.json({ success: true, message: "Remark added successfully", data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error adding O2D remark" });
  }
};

exports.getO2DStepHistory = async (req, res) => {
  try {
    const result = await o2dService.getStepHistory({ orderId: req.params.orderId }, req.user);
    if (!result.ok) return res.status(400).json({ success: false, message: result.error });
    res.json({ success: true, data: result.history, count: result.count, order: result.order });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching O2D step history" });
  }
};

exports.getO2DAlerts = async (req, res) => {
  try {
    const alerts = await o2dService.getAlerts(req.user, req.query || {});
    res.json({ success: true, data: alerts });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching O2D alerts" });
  }
};
