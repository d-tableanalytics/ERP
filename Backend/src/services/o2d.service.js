const { pool } = require("../config/db.config");

const O2D_STEPS = Object.freeze([
  "Order Entry",
  "PO Check",
  "PO Entry",
  "Despatch Doc",
  "PI Maker",
  "Order Issue",
  "PI Checker",
  "Payment Release",
  "In House RIC",
  "Sale Bill",
  "Doc Maker",
  "Doc Checker",
  "Delivery",
  "Handover EA",
  "All Document Received in Order",
]);

const STUCK_DAYS_DEFAULT = 3;
const APPROACHING_DAYS_DEFAULT = 3;

function isAdmin(user = {}) {
  return user.role === "Admin" || user.role === "SuperAdmin";
}

function userId(user = {}) {
  return user.user_id || user.id || user.User_Id || null;
}

function normalizeStepName(value = "") {
  const text = String(value || "").trim().toLowerCase();
  return O2D_STEPS.find((step) => step.toLowerCase() === text) || null;
}

function getNextStep(stepName) {
  const index = O2D_STEPS.indexOf(stepName);
  if (index < 0 || index >= O2D_STEPS.length - 1) return null;
  return O2D_STEPS[index + 1];
}

const CURRENT_STEP_FIELDS = Object.freeze([
  "currentStep",
  "current_step",
  "step",
  "stage",
  "workflowStep",
  "workflow_step",
  "workflowstep",
  "o2dStep",
  "o2d_step",
  "o2dstep",
  "active_step_name",
]);

function selectCurrentStepField(source = {}) {
  for (const field of CURRENT_STEP_FIELDS) {
    if (source[field] != null && String(source[field]).trim()) {
      return { field, value: source[field] };
    }
  }
  return { field: null, value: null };
}

function canDefaultToOrderEntry(order = {}, steps = []) {
  const hasStepRows = Array.isArray(steps) && steps.length > 0;
  const status = String(order.overall_status || "IN_PROGRESS").toUpperCase();
  return !hasStepRows && !!order.po_number && status !== "COMPLETED";
}

function applyCurrentStepMapping(order = {}, steps = []) {
  const selected = selectCurrentStepField(order.raw_order || order);
  let rawStep = selected.value;
  let selectedField = selected.field;
  let normalizedStep = normalizeStepName(rawStep);

  if (!normalizedStep && Array.isArray(steps) && steps.length) {
    const active = steps.find((step) => step.status === "IN_PROGRESS");
    const fallback = active || steps.find((step) => step.status !== "COMPLETED");
    if (fallback?.step_name) {
      rawStep = fallback.step_name;
      selectedField = active ? "o2d_order_steps.active.step_name" : "o2d_order_steps.fallback.step_name";
      normalizedStep = normalizeStepName(rawStep);
    }
  }

  const defaulted = !rawStep && !normalizedStep && canDefaultToOrderEntry(order, steps);
  if (defaulted) {
    rawStep = "Order Entry";
    selectedField = "default.orderEntry";
    normalizedStep = "Order Entry";
  }

  const nextStep = normalizedStep ? getNextStep(normalizedStep) : null;
  const invalidStep = rawStep && !normalizedStep ? rawStep : null;
  const missingStep = !rawStep && !normalizedStep;

  console.log("[O2D Step Mapping]", {
    rawOrder: order.raw_order || order,
    rawCurrentStepValue: rawStep || null,
    selectedO2DStepField: selectedField,
    normalizedO2DStep: normalizedStep || null,
    invalidStepValue: invalidStep || null,
    nextStep: nextStep || null,
    selectedCurrentStepField: selectedField,
    rawCurrentStep: rawStep || null,
    normalizedStep: normalizedStep || null,
    calculatedNextStep: nextStep || null,
    defaultedToOrderEntry: defaulted,
  });

  return {
    current_step: normalizedStep,
    raw_current_step: rawStep || null,
    selected_current_step_field: selectedField,
    invalid_current_step: invalidStep,
    invalidStepValue: invalidStep,
    missing_step_data: missingStep,
    missing_invalid_step_data: invalidStep || (missingStep ? "Missing O2D step data" : null),
    next_step: nextStep,
  };
}

function rowToOrder(row = {}) {
  const stepMapping = applyCurrentStepMapping({ ...row, raw_order: row }, []);
  return {
    id: row.id,
    po_number: row.po_number,
    firm_name: row.firm_name,
    buyer_name: row.buyer_name,
    uid: row.uid,
    delivery_date: row.delivery_date,
    party_name: row.party_name,
    customer_type: row.customer_type,
    contact_no: row.contact_no,
    alternate_no: row.alternate_no,
    email: row.email,
    location: row.location,
    state: row.state,
    representative: row.representative,
    overall_status: row.overall_status,
    created_by: row.created_by,
    created_at: row.created_at,
    ...stepMapping,
    current_step_number: row.current_step_number,
    current_step_status: row.current_step_status,
    current_step_assigned_to: row.current_step_assigned_to,
    current_step_assigned_to_name: row.current_step_assigned_to_name,
    raw_order: row,
    days_until_delivery: row.days_until_delivery != null ? Number(row.days_until_delivery) : null,
  };
}

function debugO2D({ apiName, user = {}, filters = {}, sql, totalRecords = 0, uniqueCurrentSteps = [] }) {
  const compactSql = sql ? String(sql).replace(/\s+/g, " ").trim() : undefined;
  console.log("[O2D Debug]", {
    userId: userId(user),
    role: user.role || "Employee",
    apiName,
    filters,
    sql: compactSql,
    totalRecords,
    uniqueCurrentSteps,
  });
}

function uniqueRawCurrentSteps(orders = []) {
  return [...new Set(
    orders
      .map((order) => order.raw_current_step || order.current_step || order.missing_invalid_step_data)
      .filter(Boolean)
  )];
}

async function ensureWorkflowSteps(client, orderId) {
  const existing = await client.query(
    "SELECT COUNT(*) FROM o2d_order_steps WHERE order_id=$1",
    [orderId]
  );
  if (Number(existing.rows[0].count) > 0) return;

  for (let i = 0; i < O2D_STEPS.length; i++) {
    await client.query(
      `INSERT INTO o2d_order_steps
       (order_id, step_number, step_name, status)
       VALUES ($1,$2,$3,$4)`,
      [orderId, i + 1, O2D_STEPS[i], i === 0 ? "IN_PROGRESS" : null]
    );
  }
}

async function ensureMissingWorkflowSteps(client, orderId) {
  for (let i = 0; i < O2D_STEPS.length; i++) {
    await client.query(
      `INSERT INTO o2d_order_steps (order_id, step_number, step_name, status)
       SELECT $1, $2, $3, NULL
       WHERE NOT EXISTS (
         SELECT 1 FROM o2d_order_steps
         WHERE order_id=$1 AND step_name=$3
       )`,
      [orderId, i + 1, O2D_STEPS[i]]
    );
  }
}

function buildAccessWhere(user, params, values) {
  if (isAdmin(user)) return "";
  const id = userId(user);
  values.push(id);
  return `
    AND EXISTS (
      SELECT 1 FROM o2d_order_steps access_s
      WHERE access_s.order_id = o.id
        AND access_s.assigned_to = $${values.length}
    )
  `;
}

function buildFilterWhere(filters = {}, values) {
  const where = [];
  const likeFilters = [
    ["poNumber", "o.po_number"],
    ["firm", "o.firm_name"],
    ["buyer", "o.buyer_name"],
    ["uid", "o.uid"],
    ["partyName", "o.party_name"],
    ["item", "i.item_name"],
  ];

  for (const [key, column] of likeFilters) {
    if (filters[key]) {
      values.push(`%${String(filters[key]).trim()}%`);
      where.push(`${column} ILIKE $${values.length}`);
    }
  }

  if (filters.status) {
    values.push(String(filters.status).trim());
    where.push("o.overall_status = $" + values.length);
  }

  if (filters.deliveryDate) {
    values.push(filters.deliveryDate);
    where.push("o.delivery_date::date = $" + values.length + "::date");
  }

  if (filters.currentStep) {
    const step = normalizeStepName(filters.currentStep);
    if (!step) {
      where.push("1=0");
      return ` AND ${where.join(" AND ")}`;
    }
    values.push(step);
    where.push("cs.step_name ILIKE $" + values.length);
  }

  if (filters.orderId) {
    values.push(Number(filters.orderId));
    where.push("o.id = $" + values.length);
  }

  return where.length ? ` AND ${where.join(" AND ")}` : "";
}

async function getOrders(filters = {}, user = {}, options = {}) {
  const values = [];
  const apiName = options.apiName || "getO2DOrders";
  const limit = Math.min(Math.max(Number(options.limit || filters.limit || 20), 1), 100);

  let sql = `
    WITH current_steps AS (
      SELECT DISTINCT ON (order_id)
        order_id, step_number, step_name, status, assigned_to, assigned_at, actual_date
      FROM o2d_order_steps
      WHERE status = 'IN_PROGRESS'
      ORDER BY order_id, step_number
    )
    SELECT DISTINCT
      o.*,
      cs.step_name AS active_step_name,
      cs.step_number AS current_step_number,
      cs.status AS current_step_status,
      cs.assigned_to AS current_step_assigned_to,
      CONCAT(e.first_name, ' ', e.last_name) AS current_step_assigned_to_name,
      CASE
        WHEN o.delivery_date IS NULL THEN NULL
        ELSE (o.delivery_date::date - CURRENT_DATE)
      END AS days_until_delivery
    FROM o2d_orders o
    LEFT JOIN current_steps cs ON cs.order_id = o.id
    LEFT JOIN employees e ON e.user_id = cs.assigned_to
    LEFT JOIN o2d_order_items i ON i.order_id = o.id
    WHERE 1=1
  `;

  sql += buildFilterWhere(filters, values);
  sql += buildAccessWhere(user, filters, values);
  values.push(limit);
  sql += ` ORDER BY o.created_at DESC LIMIT $${values.length}`;

  const result = await pool.query(sql, values);
  const rows = result.rows.map(rowToOrder);
  debugO2D({
    apiName,
    user,
    filters: { ...filters, limit },
    sql,
    totalRecords: rows.length,
    uniqueCurrentSteps: uniqueRawCurrentSteps(rows),
  });
  return hydrateOrders(rows);
}

async function hydrateOrders(orders = []) {
  if (!orders.length) return [];
  const ids = orders.map((order) => order.id);
  const [itemsResult, stepsResult] = await Promise.all([
    pool.query(
      `SELECT * FROM o2d_order_items WHERE order_id = ANY($1::int[]) ORDER BY id ASC`,
      [ids]
    ),
    pool.query(
      `SELECT
         s.*,
         CONCAT(e.first_name, ' ', e.last_name) AS assigned_to_name
       FROM o2d_order_steps s
       LEFT JOIN employees e ON e.user_id = s.assigned_to
       WHERE s.order_id = ANY($1::int[])
       ORDER BY s.order_id ASC, s.step_number ASC`,
      [ids]
    ),
  ]);

  const itemsByOrder = new Map();
  for (const item of itemsResult.rows) {
    if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
    itemsByOrder.get(item.order_id).push(item);
  }

  const stepsByOrder = new Map();
  for (const step of stepsResult.rows) {
    if (!stepsByOrder.has(step.order_id)) stepsByOrder.set(step.order_id, []);
    stepsByOrder.get(step.order_id).push(step);
  }

  return orders.map((order) => {
    const items = itemsByOrder.get(order.id) || [];
    const steps = stepsByOrder.get(order.id) || [];
    const stepMapping = applyCurrentStepMapping(order, steps);
    return {
      ...order,
      ...stepMapping,
      items,
      steps,
    };
  });
}

async function getOrderByPO(poNumber, user) {
  const orders = await getOrders({ poNumber, limit: 5 }, user, { limit: 5, apiName: "getO2DOrderByPO" });
  const exact = orders.find((order) => String(order.po_number || "").toLowerCase() === String(poNumber || "").toLowerCase());
  return exact || orders[0] || null;
}

async function getOrderById(orderId, user) {
  const orders = await getOrders({ orderId, limit: 1 }, user, { limit: 1, apiName: "getO2DOrderById" });
  return orders[0] || null;
}

async function getOrdersByStep(stepName, user, options = {}) {
  const normalized = normalizeStepName(stepName);
  if (!normalized) {
    return { ok: false, error: `Unknown O2D step. Valid steps are: ${O2D_STEPS.join(", ")}` };
  }
  const orders = await getOrders({ currentStep: normalized, limit: options.limit || 25 }, user, { ...options, apiName: "getO2DOrdersByStep" });
  return { ok: true, step: normalized, count: orders.length, orders };
}

async function getOverdueOrders(user, options = {}) {
  const values = [];
  let sql = `
    WITH current_steps AS (
      SELECT DISTINCT ON (order_id)
        order_id, step_number, step_name, status, assigned_to
      FROM o2d_order_steps
      WHERE status = 'IN_PROGRESS'
      ORDER BY order_id, step_number
    )
    SELECT
      o.*,
      cs.step_name AS active_step_name,
      cs.step_number AS current_step_number,
      cs.status AS current_step_status,
      cs.assigned_to AS current_step_assigned_to,
      CONCAT(e.first_name, ' ', e.last_name) AS current_step_assigned_to_name,
      (CURRENT_DATE - o.delivery_date::date) AS overdue_days,
      (o.delivery_date::date - CURRENT_DATE) AS days_until_delivery
    FROM o2d_orders o
    LEFT JOIN current_steps cs ON cs.order_id = o.id
    LEFT JOIN employees e ON e.user_id = cs.assigned_to
    WHERE o.delivery_date::date < CURRENT_DATE
      AND COALESCE(o.overall_status, 'IN_PROGRESS') != 'COMPLETED'
  `;
  sql += buildAccessWhere(user, {}, values);
  values.push(Math.min(Math.max(Number(options.limit || 25), 1), 100));
  sql += ` ORDER BY o.delivery_date ASC LIMIT $${values.length}`;

  const result = await pool.query(sql, values);
  const rows = result.rows.map((row) => ({ ...rowToOrder(row), overdue_days: Number(row.overdue_days) }));
  debugO2D({
    apiName: "getO2DOverdueOrders",
    user,
    filters: { limit: Math.min(Math.max(Number(options.limit || 25), 1), 100) },
    sql,
    totalRecords: rows.length,
    uniqueCurrentSteps: uniqueRawCurrentSteps(rows),
  });
  const orders = await hydrateOrders(rows);
  return { ok: true, count: orders.length, orders };
}

async function getSummary(user) {
  const orders = await getOrders({ limit: 100 }, user, { limit: 100, apiName: "getO2DSummary" });
  const byStep = {};
  const byStatus = {};
  const invalidStepCounts = {};
  for (const step of O2D_STEPS) byStep[step] = 0;
  for (const order of orders) {
    byStatus[order.overall_status || "IN_PROGRESS"] = (byStatus[order.overall_status || "IN_PROGRESS"] || 0) + 1;
    if (order.current_step && O2D_STEPS.includes(order.current_step)) {
      byStep[order.current_step] = (byStep[order.current_step] || 0) + 1;
    } else if (order.missing_invalid_step_data) {
      invalidStepCounts[order.missing_invalid_step_data] = (invalidStepCounts[order.missing_invalid_step_data] || 0) + 1;
    }
  }
  const overdue = orders.filter((order) => order.delivery_date && new Date(order.delivery_date) < new Date(new Date().toDateString()) && order.overall_status !== "COMPLETED");
  const approaching = orders.filter((order) => order.days_until_delivery != null && order.days_until_delivery >= 0 && order.days_until_delivery <= APPROACHING_DAYS_DEFAULT && order.overall_status !== "COMPLETED");
  return {
    ok: true,
    total: orders.length,
    byStatus,
    byStep,
    invalidSteps: Object.entries(invalidStepCounts).map(([step, count]) => ({ step, count })),
    validSteps: O2D_STEPS,
    uniqueCurrentSteps: uniqueRawCurrentSteps(orders),
    overdueCount: overdue.length,
    approachingDeliveryCount: approaching.length,
  };
}

async function addRemark({ orderId, poNumber, remark }, user) {
  const order = await resolveOrder({ orderId, poNumber }, user);
  if (!order) return { ok: false, error: "O2D order not found or not accessible." };

  const result = await pool.query(
    `INSERT INTO o2d_order_remarks (order_id, remark, created_by)
     VALUES ($1,$2,$3)
     RETURNING *`,
    [order.id, remark, userId(user)]
  );

  return { ok: true, order, remark: result.rows[0] };
}

async function getStepHistory({ orderId, poNumber }, user) {
  const order = await resolveOrder({ orderId, poNumber }, user);
  if (!order) return { ok: false, error: "O2D order not found or not accessible." };

  const result = await pool.query(
    `SELECT
       h.*,
       CONCAT(e.first_name, ' ', e.last_name) AS changed_by_name
     FROM o2d_step_history h
     LEFT JOIN employees e ON e.user_id = h.changed_by
     WHERE h.order_id=$1
     ORDER BY h.changed_at DESC`,
    [order.id]
  );

  return { ok: true, order, count: result.rows.length, history: result.rows };
}

async function resolveOrder({ orderId, poNumber }, user) {
  if (orderId) {
    return getOrderById(orderId, user);
  }
  if (poNumber) return getOrderByPO(poNumber, user);
  return null;
}

async function updateStep({ orderId, poNumber, fromStep, toStep, remarks, confirmed = false, adminOverride = false }, user) {
  const actorId = userId(user);
  const admin = isAdmin(user);
  const order = await resolveOrder({ orderId, poNumber }, user);
  if (!order) return { ok: false, error: "O2D order not found or not accessible." };

  const active = order.steps.find((step) => step.status === "IN_PROGRESS") || order.steps.find((step) => step.status !== "COMPLETED");
  if (!active) return { ok: false, error: "This O2D order has no active step." };

  const rawCurrentStep = active.step_name;
  const currentStep = normalizeStepName(rawCurrentStep);
  if (!currentStep) {
    return {
      ok: false,
      error: `Current O2D step "${rawCurrentStep}" is not mapped to the valid O2D workflow. Please fix the order step before moving it.`,
      invalidCurrentStep: rawCurrentStep,
      validSteps: O2D_STEPS,
    };
  }
  const expectedNext = getNextStep(currentStep);
  const requestedFrom = fromStep ? normalizeStepName(fromStep) : currentStep;
  const requestedTo = toStep ? normalizeStepName(toStep) : expectedNext;

  if (fromStep && !requestedFrom) return { ok: false, error: `"${fromStep}" is not a valid O2D step.`, validSteps: O2D_STEPS };
  if (toStep && !requestedTo) return { ok: false, error: `"${toStep}" is not a valid O2D step.`, validSteps: O2D_STEPS };
  if (!requestedTo) return { ok: false, error: "Please provide a valid next O2D step." };
  if (requestedFrom && requestedFrom !== currentStep) {
    return { ok: false, error: `Current step is ${currentStep}. I cannot move it from ${requestedFrom}.` };
  }
  if (requestedTo !== expectedNext && !(admin && adminOverride)) {
    return {
      ok: false,
      error: `The correct next step after ${currentStep} is ${expectedNext || "none"}. Admin override is required for ${requestedTo}.`,
      currentStep,
      expectedNext,
      requestedTo,
    };
  }
  if (!admin && active.assigned_to && Number(active.assigned_to) !== Number(actorId)) {
    return { ok: false, error: "Only the assigned employee or an admin can update this O2D step." };
  }
  if (!admin && !active.assigned_to) {
    return { ok: false, error: "This step is not assigned yet. Please ask an admin to assign it first." };
  }
  if (!confirmed) {
    return {
      ok: true,
      requiresConfirmation: true,
      message: `Please confirm: move PO ${order.po_number || order.id} from ${currentStep} to ${requestedTo}?`,
      order: summarizeOrder(order),
      fromStep: currentStep,
      toStep: requestedTo,
    };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureWorkflowSteps(client, order.id);

    await client.query(
      `UPDATE o2d_order_steps
       SET status='COMPLETED', actual_date=NOW(), remarks=COALESCE($3, remarks)
       WHERE id=$1 AND order_id=$2`,
      [active.id, order.id, remarks || null]
    );

    const target = await client.query(
      `UPDATE o2d_order_steps
       SET status='IN_PROGRESS', assigned_at=COALESCE(assigned_at, NOW())
       WHERE order_id=$1 AND step_name=$2
       RETURNING *`,
      [order.id, requestedTo]
    );

    if (!target.rows.length) {
      throw new Error("Target O2D step was not found.");
    }

    await client.query(
      `INSERT INTO o2d_step_history
       (order_id, po_number, from_step, to_step, changed_by, remarks)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [order.id, order.po_number || null, currentStep, requestedTo, actorId, remarks || null]
    );

    if (requestedTo === O2D_STEPS[O2D_STEPS.length - 1]) {
      await client.query(
        "UPDATE o2d_orders SET overall_status='COMPLETED' WHERE id=$1",
        [order.id]
      );
    }

    await client.query("COMMIT");
    const updated = await resolveOrder({ orderId: order.id }, user);
    return {
      ok: true,
      message: `PO ${updated.po_number || updated.id} moved from ${currentStep} to ${requestedTo}.`,
      order: summarizeOrder(updated),
      fromStep: currentStep,
      toStep: requestedTo,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function correctCurrentStep({ orderId, poNumber, toStep, remarks }, user) {
  const actorId = userId(user);
  const admin = isAdmin(user);
  const targetStep = normalizeStepName(toStep);
  if (!targetStep) {
    return {
      ok: false,
      error: `"${toStep}" is not a valid O2D step.`,
      validSteps: O2D_STEPS,
    };
  }

  const order = await resolveOrder({ orderId, poNumber }, user);
  if (!order) return { ok: false, error: "O2D order not found or not accessible." };

  const active = order.steps.find((step) => step.status === "IN_PROGRESS") || order.steps.find((step) => step.status !== "COMPLETED");
  if (!admin) {
    if (!active?.assigned_to || Number(active.assigned_to) !== Number(actorId)) {
      return { ok: false, error: "Only an admin or the assigned O2D owner can correct this step." };
    }
  }

  const previousRawStep = active?.step_name || order.raw_current_step || null;
  const previousNormalizedStep = normalizeStepName(previousRawStep);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (active?.id) {
      await client.query(
        `UPDATE o2d_order_steps
         SET step_name=$1,
             step_number=$2,
             status='IN_PROGRESS',
             remarks=COALESCE($3, remarks)
         WHERE id=$4 AND order_id=$5`,
        [targetStep, O2D_STEPS.indexOf(targetStep) + 1, remarks || null, active.id, order.id]
      );
    } else {
      await client.query(
        `INSERT INTO o2d_order_steps
         (order_id, step_number, step_name, assigned_to, assigned_by, status, remarks)
         VALUES ($1,$2,$3,$4,$5,'IN_PROGRESS',$6)`,
        [order.id, O2D_STEPS.indexOf(targetStep) + 1, targetStep, actorId, actorId, remarks || null]
      );
    }

    await ensureMissingWorkflowSteps(client, order.id);

    await client.query(
      `INSERT INTO o2d_step_history
       (order_id, po_number, from_step, to_step, changed_by, remarks)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        order.id,
        order.po_number || null,
        previousRawStep || "Missing O2D step data",
        targetStep,
        actorId,
        remarks || (previousNormalizedStep ? "O2D current step corrected" : `Invalid/missing O2D step corrected from ${previousRawStep || "missing value"}`),
      ]
    );

    await client.query("COMMIT");
    const updated = await resolveOrder({ orderId: order.id }, user);
    return {
      ok: true,
      message: `PO ${updated.po_number || updated.id} current O2D step updated to ${targetStep}.`,
      order: summarizeOrder(updated),
      poNumber: updated.po_number,
      previousRawStep,
      invalidStepValue: previousRawStep && !previousNormalizedStep ? previousRawStep : null,
      fromStep: previousRawStep || "Missing O2D step data",
      toStep: targetStep,
      currentStep: updated.current_step,
      nextStep: updated.next_step,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function getAlerts(user, options = {}) {
  const stuckDays = Number(options.stuckDays || STUCK_DAYS_DEFAULT);
  const approachingDays = Number(options.approachingDays || APPROACHING_DAYS_DEFAULT);
  const orders = await getOrders({ limit: 100 }, user, { limit: 100, apiName: "getO2DAlerts" });
  const today = new Date(new Date().toDateString());

  const overdue = [];
  const approachingDelivery = [];
  const stuck = [];

  for (const order of orders) {
    if (order.overall_status === "COMPLETED") continue;
    if (order.delivery_date) {
      const delivery = new Date(order.delivery_date);
      const diffDays = Math.ceil((delivery - today) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) overdue.push({ ...summarizeOrder(order), overdueDays: Math.abs(diffDays) });
      if (diffDays >= 0 && diffDays <= approachingDays) approachingDelivery.push({ ...summarizeOrder(order), daysUntilDelivery: diffDays });
    }

    const active = order.steps.find((step) => step.status === "IN_PROGRESS");
    if (active) {
      const since = active.actual_date || active.assigned_at || order.created_at;
      const daysAtStep = Math.floor((Date.now() - new Date(since).getTime()) / (1000 * 60 * 60 * 24));
      if (daysAtStep >= stuckDays) stuck.push({ ...summarizeOrder(order), daysAtStep });
    }
  }

  return { ok: true, overdue, stuck, approachingDelivery };
}

function summarizeOrder(order = {}) {
  return {
    id: order.id,
    po_number: order.po_number,
    firm_name: order.firm_name,
    buyer_name: order.buyer_name,
    uid: order.uid,
    delivery_date: order.delivery_date,
    party_name: order.party_name,
    item_names: Array.isArray(order.items) ? order.items.map((item) => item.item_name).filter(Boolean) : [],
    overall_status: order.overall_status,
    current_step: order.current_step,
    invalid_current_step: order.invalid_current_step,
    invalidStepValue: order.invalidStepValue || order.invalid_current_step,
    missing_step_data: order.missing_step_data,
    missing_invalid_step_data: order.missing_invalid_step_data,
    selected_current_step_field: order.selected_current_step_field,
    raw_current_step: order.raw_current_step,
    next_step: order.next_step,
    days_until_delivery: order.days_until_delivery,
    assigned_to: order.current_step_assigned_to_name,
  };
}

module.exports = {
  O2D_STEPS,
  isAdmin,
  userId,
  normalizeStepName,
  getNextStep,
  getOrders,
  getOrderById,
  getOrderByPO,
  getOrdersByStep,
  getOverdueOrders,
  getSummary,
  updateStep,
  correctCurrentStep,
  addRemark,
  getStepHistory,
  getAlerts,
  summarizeOrder,
};
