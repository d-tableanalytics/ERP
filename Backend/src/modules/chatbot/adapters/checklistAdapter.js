const db = require('../../../config/db.config');
const { isOverdue, formatDDMMYYYY } = require('../utils/time');
const { bestMatch } = require('../utils/fuzzy');

/**
 * Checklist adapter — reuses the same SQL shape as the existing checklist
 * controller but exposed as plain functions returning chatbot-shaped objects.
 */

const BASE_SELECT = `
  SELECT c.id, c.question, c.status, c.priority, c.due_date,
         c.assignee_id, c.assignee_name, c.doer_id, c.doer_name,
         c.verifier_id, c.verifier_name, c.department, c.frequency,
         c.created_at, c.completed_at
    FROM checklist c
`;

function summarize(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.question,
    status: row.status || 'Pending',
    priority: row.priority || null,
    frequency: row.frequency || null,
    dueDate: row.due_date,
    dueDateFormatted: formatDDMMYYYY(row.due_date),
    overdue: isOverdue(row.due_date) && String(row.status || '').toLowerCase() !== 'completed',
    assignee: row.assignee_name || null,
    doer: row.doer_name || null,
    verifier: row.verifier_name || null,
    department: row.department || null,
  };
}

async function getMyChecklists(userId, { status, frequency, limit = 10 } = {}) {
  const conditions = [`(c.assignee_id = $1 OR c.doer_id = $1 OR c.verifier_id = $1)`];
  const values = [userId];
  if (status) {
    if (String(status).toLowerCase() === 'overdue') {
      conditions.push(`c.status NOT IN ('Completed','Verified') AND c.due_date < NOW()`);
    } else {
      values.push(status);
      conditions.push(`c.status = $${values.length}`);
    }
  }
  if (frequency) {
    values.push(String(frequency).toLowerCase());
    conditions.push(`LOWER(c.frequency) = $${values.length}`);
  }
  const cap = Math.min(limit && limit > 0 ? limit : 10, 25);
  values.push(cap);
  const sql = `${BASE_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY c.id DESC LIMIT $${values.length}`;
  const { rows } = await db.query(sql, values);
  return rows.map(summarize);
}

async function countMyChecklists(userId, { status } = {}) {
  const conditions = [`(assignee_id = $1 OR doer_id = $1 OR verifier_id = $1)`];
  const values = [userId];
  if (status) {
    if (String(status).toLowerCase() === 'overdue') {
      conditions.push(`status NOT IN ('Completed','Verified') AND due_date < NOW()`);
    } else {
      values.push(status);
      conditions.push(`status = $${values.length}`);
    }
  }
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM checklist WHERE ${conditions.join(' AND ')}`,
    values
  );
  return rows[0]?.n ?? 0;
}

async function getOverdue(userId) {
  return getMyChecklists(userId, { status: 'overdue' });
}

async function getChecklistDetail(userId, { checklistId, name } = {}) {
  if (checklistId) {
    const { rows } = await db.query(
      `${BASE_SELECT} WHERE c.id = $1 AND (c.assignee_id = $2 OR c.doer_id = $2 OR c.verifier_id = $2)`,
      [checklistId, userId]
    );
    return summarize(rows[0]);
  }
  if (name) {
    const { rows } = await db.query(
      `${BASE_SELECT} WHERE (c.assignee_id = $1 OR c.doer_id = $1 OR c.verifier_id = $1) ORDER BY c.id DESC LIMIT 100`,
      [userId]
    );
    const m = bestMatch(name, rows, (r) => r.question || '');
    return m ? summarize(m.item) : null;
  }
  return null;
}

module.exports = {
  getMyChecklists,
  countMyChecklists,
  getOverdue,
  getChecklistDetail,
  _summarize: summarize,
};
