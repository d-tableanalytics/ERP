const { pool } = require("../../config/db.config");

// ─── Self-scope phrases ───────────────────────────────────────────────────────
const SELF_SCOPE_PHRASES = [
  "my tasks", "my work", "my checklist", "my delegation",
  "my ticket", "assigned to me", "mine", "my pending", "my overdue",
];

// ─── Analytics intent keywords ────────────────────────────────────────────────
const ANALYTICS_KEYWORDS = [
  "overload", "overdue", "follow up", "follow-up", "followup",
  "attention", "who has the most", "busiest", "behind schedule",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function detectSelfScope(msg) {
  return SELF_SCOPE_PHRASES.some((phrase) => msg.includes(phrase));
}

function detectAnalyticsIntent(msg) {
  return ANALYTICS_KEYWORDS.some((kw) => msg.includes(kw));
}

/**
 * Match an employee name in the message.
 * Precedence: exact full-name → first-name only → last-name only.
 * Returns the matched employee row or null.
 */
function matchEmployee(msg, employees) {
  const lowerMsg = msg.toLowerCase();

  // 1. Exact full-name match
  for (const emp of employees) {
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    if (lowerMsg.includes(fullName)) return emp;
  }

  // 2. Partial first-name match (only if unambiguous)
  const firstNameMatches = employees.filter((emp) =>
    lowerMsg.includes(emp.first_name.toLowerCase())
  );
  if (firstNameMatches.length === 1) return firstNameMatches[0];

  // 3. Partial last-name match (only if unambiguous)
  const lastNameMatches = employees.filter((emp) =>
    lowerMsg.includes(emp.last_name.toLowerCase())
  );
  if (lastNameMatches.length === 1) return lastNameMatches[0];

  return null;
}

// ─── Intent detection ─────────────────────────────────────────────────────────
function detectIntentMain(message) {
  const msg = message.toLowerCase();
  if (detectAnalyticsIntent(msg)) return "analytics";
  if (msg.includes("checklist") || msg.includes("chcklst")) return "checklist";
  if (msg.includes("delegat")) return "delegation";
  if (msg.includes("ticket") || msg.includes("tict")) return "help_ticket";
  if (msg.includes("attend")) return "attendance";
  if (
    msg.includes("task") ||
    msg.includes("work") ||
    msg.includes("pending") ||
    msg.includes("assigned") ||
    msg.includes("todo") ||
    msg.includes("to do")
  )
    return "task";
  return "general";
}

// ─── Scope resolution ─────────────────────────────────────────────────────────
/**
 * Returns { scopeType, filterUserId }
 * scopeType: 'self' | 'employee' | 'admin' | 'role_based'
 */
function resolveScope(userId, userRole, msg, matchedEmployee) {
  const isAdmin = ["Admin", "SuperAdmin"].includes(userRole);

  // Rule 1 — self-scope wins unconditionally
  if (detectSelfScope(msg)) {
    return { scopeType: "self", filterUserId: userId };
  }

  // Rule 2 — named employee
  if (matchedEmployee) {
    return { scopeType: "employee", filterUserId: matchedEmployee.user_id };
  }

  // Rule 3 — admin-wide (no scope cue)
  if (isAdmin) {
    return { scopeType: "admin", filterUserId: null };
  }

  // Rule 4 — standard role-based filter
  return { scopeType: "role_based", filterUserId: userId };
}

// ─── Analytics aggregate queries ──────────────────────────────────────────────
async function fetchChecklistAnalytics(whereClause, params) {
  const q = `
    SELECT
      doer_name,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE LOWER(status) = 'pending')                         AS pending,
      COUNT(*) FILTER (WHERE due_date < NOW() AND LOWER(status) != 'completed') AS overdue,
      COUNT(*) FILTER (WHERE LOWER(priority) = 'high')                          AS high_priority
    FROM checklist
    ${whereClause}
    GROUP BY doer_name
    ORDER BY pending DESC, overdue DESC
  `;
  const res = await pool.query(q, params);
  return res.rows;
}

async function fetchDelegationAnalytics(whereClause, params) {
  const q = `
    SELECT
      doer_name,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE LOWER(status) IN ('pending','need clarity','need revision','hold')) AS pending,
      COUNT(*) FILTER (WHERE due_date < NOW() AND LOWER(status) NOT IN ('completed','complete'))  AS overdue,
      COUNT(*) FILTER (WHERE LOWER(priority) = 'high')                                           AS high_priority,
      COUNT(*) FILTER (WHERE LOWER(status) = 'need clarity')                                     AS need_clarity,
      COUNT(*) FILTER (WHERE LOWER(status) = 'need revision')                                    AS need_revision,
      COUNT(*) FILTER (WHERE LOWER(status) = 'hold')                                             AS on_hold
    FROM delegation
    ${whereClause}
    GROUP BY doer_name
    ORDER BY pending DESC, overdue DESC
  `;
  const res = await pool.query(q, params);
  return res.rows;
}

async function fetchTicketAnalytics(whereClause, params) {
  const q = `
    SELECT
      e.first_name || ' ' || e.last_name AS solver_name,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE LOWER(t.status) IN ('open','in progress','pending')) AS open_count,
      COUNT(*) FILTER (WHERE LOWER(t.priority) = 'high')                         AS high_priority
    FROM help_tickets t
    LEFT JOIN employees e ON t.problem_solver = e.user_id
    ${whereClause}
    GROUP BY e.first_name, e.last_name
    ORDER BY open_count DESC
  `;
  const res = await pool.query(q, params);
  return res.rows;
}

// ─── Detail (display) queries ─────────────────────────────────────────────────
async function fetchChecklistDetail(whereClause, params) {
  const q = `
    SELECT
      c.id, c.question AS title, c.status, c.priority, c.due_date,
      c.assignee_name AS assigned_by,
      c.doer_name     AS doer
    FROM checklist c
    ${whereClause}
    ORDER BY c.id DESC
    LIMIT 30
  `;
  const res = await pool.query(q, params);
  return res.rows;
}

async function fetchDelegationDetail(whereClause, params) {
  const q = `
    SELECT
      d.id, d.delegation_name AS title, d.status, d.priority, d.due_date,
      d.delegator_name AS assigned_by,
      d.doer_name      AS doer
    FROM delegation d
    ${whereClause}
    ORDER BY d.created_at DESC
    LIMIT 30
  `;
  const res = await pool.query(q, params);
  return res.rows;
}

async function fetchTicketDetail(whereClause, params) {
  const q = `
    SELECT
      t.id, t.help_ticket_no AS title, t.issue_description, t.status, t.priority,
      e1.first_name || ' ' || e1.last_name AS raised_by,
      e2.first_name || ' ' || e2.last_name AS solver_name
    FROM help_tickets t
    LEFT JOIN employees e1 ON t.raised_by      = e1.user_id
    LEFT JOIN employees e2 ON t.problem_solver  = e2.user_id
    ${whereClause}
    ORDER BY t.created_at DESC
    LIMIT 30
  `;
  const res = await pool.query(q, params);
  return res.rows;
}

// ─── WHERE clause builders ────────────────────────────────────────────────────
function buildChecklistWhere(scopeType, filterUserId) {
  if (!filterUserId) return { where: "", params: [] };
  if (scopeType === "self") {
    return {
      where: "WHERE (c.doer_id = $1 OR c.assignee_id = $1 OR c.verifier_id = $1)",
      params: [filterUserId],
    };
  }
  // employee scope — filter by doer only (named person's work)
  return { where: "WHERE c.doer_id = $1", params: [filterUserId] };
}

function buildDelegationWhere(scopeType, filterUserId) {
  if (!filterUserId) return { where: "", params: [] };
  if (scopeType === "self") {
    return {
      where: "WHERE (d.doer_id = $1 OR d.delegator_id = $1)",
      params: [filterUserId],
    };
  }
  return { where: "WHERE d.doer_id = $1", params: [filterUserId] };
}

function buildTicketWhere(scopeType, filterUserId) {
  if (!filterUserId) return { where: "", params: [] };
  if (scopeType === "self") {
    return {
      where: "WHERE (t.raised_by = $1 OR t.pc_accountable = $1 OR t.problem_solver = $1)",
      params: [filterUserId],
    };
  }
  return { where: "WHERE t.problem_solver = $1", params: [filterUserId] };
}

// Analytics queries don't use table alias prefix — no `c.`/`d.`/`t.` in WHERE
function buildRawChecklistWhere(scopeType, filterUserId) {
  if (!filterUserId) return { where: "", params: [] };
  if (scopeType === "self") {
    return {
      where: "WHERE (doer_id = $1 OR assignee_id = $1 OR verifier_id = $1)",
      params: [filterUserId],
    };
  }
  return { where: "WHERE doer_id = $1", params: [filterUserId] };
}

function buildRawDelegationWhere(scopeType, filterUserId) {
  if (!filterUserId) return { where: "", params: [] };
  if (scopeType === "self") {
    return {
      where: "WHERE (doer_id = $1 OR delegator_id = $1)",
      params: [filterUserId],
    };
  }
  return { where: "WHERE doer_id = $1", params: [filterUserId] };
}

// ─── Context block formatters ─────────────────────────────────────────────────
function formatAnalyticsBlock(clRows, delRows, ticketRows) {
  let block = "ANALYTICS SUMMARY:\n";

  if (clRows.length > 0) {
    block += "\nChecklist workload by employee:\n";
    clRows.forEach((r) => {
      block += `  • ${r.doer_name || "Unassigned"}: Total=${r.total}, Pending=${r.pending}, Overdue=${r.overdue}, High-Priority=${r.high_priority}\n`;
    });
  }

  if (delRows.length > 0) {
    block += "\nDelegation workload by employee:\n";
    delRows.forEach((r) => {
      block += `  • ${r.doer_name || "Unassigned"}: Total=${r.total}, Pending=${r.pending}, Overdue=${r.overdue}, High-Priority=${r.high_priority}, Need-Clarity=${r.need_clarity}, Need-Revision=${r.need_revision}, On-Hold=${r.on_hold}\n`;
    });
  }

  if (ticketRows.length > 0) {
    block += "\nHelp Ticket workload by solver:\n";
    ticketRows.forEach((r) => {
      block += `  • ${r.solver_name || "Unassigned"}: Total=${r.total}, Open/Pending=${r.open_count}, High-Priority=${r.high_priority}\n`;
    });
  }

  return block;
}

function formatChecklistDetail(rows) {
  if (!rows.length) return null;
  let block = "CHECKLIST RECORDS:\n";
  rows.forEach((r) => {
    block += `  [MODULE: checklist] ${r.doer || "Unassigned"} — ${r.title} [Status: ${r.status || "Pending"}, Priority: ${r.priority || "Normal"}, Due: ${r.due_date ? r.due_date.toISOString().split("T")[0] : "N/A"}, Assigned by: ${r.assigned_by || "Unknown"}]\n`;
  });
  return block;
}

function formatDelegationDetail(rows) {
  if (!rows.length) return null;
  let block = "DELEGATION RECORDS:\n";
  rows.forEach((r) => {
    block += `  [MODULE: delegation] ${r.doer || "Unassigned"} — ${r.title} [Status: ${r.status || "Pending"}, Priority: ${r.priority || "Normal"}, Due: ${r.due_date ? r.due_date.toISOString().split("T")[0] : "N/A"}, Assigned by: ${r.assigned_by || "Unknown"}]\n`;
  });
  return block;
}

function formatTicketDetail(rows) {
  if (!rows.length) return null;
  let block = "HELP TICKET RECORDS:\n";
  rows.forEach((r) => {
    const desc = r.issue_description
      ? r.issue_description.substring(0, 50) + "..."
      : "";
    block += `  [MODULE: help_ticket] ${r.solver_name || "Unassigned"} — ${r.title}: ${desc} [Status: ${r.status || "Open"}, Priority: ${r.priority || "Normal"}, Raised by: ${r.raised_by || "Unknown"}]\n`;
  });
  return block;
}

// ─── Main exports ─────────────────────────────────────────────────────────────
const CHATBOT_CONTEXT = {
  systemPrompt: `You are the ERP Assistant for DTA_RACPL.`,
  openaiSystemPrompt: ``,
  knowledgeInstruction: ``,
  allowedTopics: [],
  blockedTopics: [],
  intents: {},
  responses: {},
  validation: {
    maxMessageLength: 500,
    minMessageLength: 1,
  },
  performance: {
    conversationLogBatchSize: 10,
    cacheResponseMs: 300000,
  },

  detectIntentMain,

  buildContext: async function (userId, message, userRole) {
    const msg = message.toLowerCase();
    const intent = this.detectIntentMain(msg);
    let contextBlocks = [];

    try {
      // ── Step 1: Load all employees for name matching ──
      const empRes = await pool.query(
        "SELECT user_id, first_name, last_name FROM employees"
      );
      const employees = empRes.rows;

      // ── Step 2: Resolve scope (self > named employee > admin > role-based) ──
      const matchedEmployee = detectSelfScope(msg)
        ? null // self-scope wins — skip name matching
        : matchEmployee(msg, employees);

      const { scopeType, filterUserId } = resolveScope(
        userId,
        userRole,
        msg,
        matchedEmployee
      );

      // ── Step 3: Determine which modules to query ──
      const needsChecklist = ["checklist", "task", "analytics", "general"].includes(intent);
      const needsDelegation = ["delegation", "task", "analytics", "general"].includes(intent);
      const needsTickets = ["help_ticket", "task", "analytics", "general"].includes(intent);

      // ── Step 4: Analytics aggregate blocks ──
      let analyticsBlock = null;
      if (needsChecklist || needsDelegation || needsTickets) {
        const [clWhere, delWhere] = [
          buildRawChecklistWhere(scopeType, filterUserId),
          buildRawDelegationWhere(scopeType, filterUserId),
        ];
        const ticketWhere = buildTicketWhere(scopeType, filterUserId);

        const [clAnalytics, delAnalytics, ticketAnalytics] = await Promise.all([
          needsChecklist ? fetchChecklistAnalytics(clWhere.where, clWhere.params) : Promise.resolve([]),
          needsDelegation ? fetchDelegationAnalytics(delWhere.where, delWhere.params) : Promise.resolve([]),
          needsTickets ? fetchTicketAnalytics(ticketWhere.where, ticketWhere.params) : Promise.resolve([]),
        ]);

        const analytics = formatAnalyticsBlock(clAnalytics, delAnalytics, ticketAnalytics);
        if (analytics.length > "ANALYTICS SUMMARY:\n".length) {
          analyticsBlock = analytics;
        }
      }

      if (analyticsBlock) contextBlocks.push(analyticsBlock);

      // ── Step 5: Detail display blocks (limited rows) ──
      if (needsChecklist) {
        const { where, params } = buildChecklistWhere(scopeType, filterUserId);
        const rows = await fetchChecklistDetail(where, params);
        const block = formatChecklistDetail(rows);
        if (block) contextBlocks.push(block);
      }

      if (needsDelegation) {
        const { where, params } = buildDelegationWhere(scopeType, filterUserId);
        const rows = await fetchDelegationDetail(where, params);
        const block = formatDelegationDetail(rows);
        if (block) contextBlocks.push(block);
      }

      if (needsTickets) {
        const { where, params } = buildTicketWhere(scopeType, filterUserId);
        const rows = await fetchTicketDetail(where, params);
        const block = formatTicketDetail(rows);
        if (block) contextBlocks.push(block);
      }
    } catch (err) {
      console.error("Context Builder DB Error:", err);
    }

    const fallbackMessage =
      "No specific records found for your query. " +
      "I can help with: pending tasks, help tickets, employee workloads, overdue items, and delegation status. " +
      "Try asking: 'Show my pending checklist', 'Who is overloaded?', or 'Show delegations assigned to Rahul'.";

    const contextString =
      contextBlocks.length > 0
        ? contextBlocks.join("\n\n")
        : fallbackMessage;

    return { intent, contextString };
  },
};

module.exports = CHATBOT_CONTEXT;