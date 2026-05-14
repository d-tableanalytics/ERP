const db = require('../../../config/db.config');

/**
 * Dashboard adapter — aggregates counts across modules for the requesting user.
 */

async function getSummary(userId) {
  const [tasksRes, checklistsRes, ticketsRes] = await Promise.all([
    db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'Pending')                              AS pending,
         COUNT(*) FILTER (WHERE status = 'In Progress')                          AS in_progress,
         COUNT(*) FILTER (WHERE status = 'Completed')                            AS completed,
         COUNT(*) FILTER (WHERE status NOT IN ('Completed') AND due_date < NOW()) AS overdue,
         COUNT(*)                                                                AS total
       FROM tasks
       WHERE doer_id = $1 AND deleted_at IS NULL`,
      [userId]
    ),
    db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'Pending')                                  AS pending,
         COUNT(*) FILTER (WHERE status = 'Completed' OR status = 'Verified')         AS completed,
         COUNT(*) FILTER (WHERE status NOT IN ('Completed','Verified') AND due_date < NOW()) AS overdue,
         COUNT(*)                                                                    AS total
       FROM checklist
       WHERE assignee_id = $1 OR doer_id = $1 OR verifier_id = $1`,
      [userId]
    ),
    db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'OPEN')   AS open,
         COUNT(*) FILTER (WHERE status = 'CLOSED') AS closed,
         COUNT(*)                                  AS total
       FROM help_tickets
       WHERE raised_by = $1 OR pc_accountable = $1 OR problem_solver = $1`,
      [userId]
    ),
  ]);

  return {
    tasks: {
      pending: Number(tasksRes.rows[0].pending) || 0,
      inProgress: Number(tasksRes.rows[0].in_progress) || 0,
      completed: Number(tasksRes.rows[0].completed) || 0,
      overdue: Number(tasksRes.rows[0].overdue) || 0,
      total: Number(tasksRes.rows[0].total) || 0,
    },
    checklists: {
      pending: Number(checklistsRes.rows[0].pending) || 0,
      completed: Number(checklistsRes.rows[0].completed) || 0,
      overdue: Number(checklistsRes.rows[0].overdue) || 0,
      total: Number(checklistsRes.rows[0].total) || 0,
    },
    tickets: {
      open: Number(ticketsRes.rows[0].open) || 0,
      closed: Number(ticketsRes.rows[0].closed) || 0,
      total: Number(ticketsRes.rows[0].total) || 0,
    },
  };
}

/**
 * Admin-tier: aggregate workload across users (optionally filtered by department).
 */
async function getTeamWorkload({ department = null } = {}) {
  const values = [];
  let depClause = '';
  if (department) {
    values.push(department);
    depClause = ` AND e.department = $${values.length}`;
  }
  const { rows } = await db.query(
    `SELECT e.user_id, e.first_name, e.last_name, e.department,
            COUNT(t.id) FILTER (WHERE t.status = 'Pending') AS pending,
            COUNT(t.id) FILTER (WHERE t.status NOT IN ('Completed') AND t.due_date < NOW()) AS overdue,
            COUNT(t.id) AS total
       FROM employees e
       LEFT JOIN tasks t ON t.doer_id = e.user_id AND t.deleted_at IS NULL
      WHERE e.deleted_at IS NULL ${depClause}
      GROUP BY e.user_id, e.first_name, e.last_name, e.department
      ORDER BY pending DESC, overdue DESC
      LIMIT 25`,
    values
  );
  return rows.map((r) => ({
    userId: r.user_id,
    name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
    department: r.department || null,
    pending: Number(r.pending) || 0,
    overdue: Number(r.overdue) || 0,
    total: Number(r.total) || 0,
  }));
}

module.exports = { getSummary, getTeamWorkload };
