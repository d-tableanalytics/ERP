const db = require('../../../config/db.config');
const { formatDDMMYYYY } = require('../utils/time');

/**
 * Help-ticket adapter — read-only summary of a user's tickets.
 */

function summarize(row) {
  if (!row) return null;
  return {
    id: row.id,
    ticketNo: row.help_ticket_no,
    issue: row.issue_description ? String(row.issue_description).slice(0, 200) : null,
    status: row.status,
    priority: row.priority || null,
    stage: row.current_stage || null,
    desiredDate: row.desired_date,
    desiredDateFormatted: formatDDMMYYYY(row.desired_date),
    createdAt: row.created_at,
    location: row.location || null,
  };
}

async function getMyTickets(userId, { status, limit = 10 } = {}) {
  const conditions = [`(raised_by = $1 OR pc_accountable = $1 OR problem_solver = $1)`];
  const values = [userId];
  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }
  const cap = Math.min(limit && limit > 0 ? limit : 10, 25);
  values.push(cap);
  const { rows } = await db.query(
    `SELECT id, help_ticket_no, issue_description, status, priority, current_stage,
            desired_date, created_at, location
       FROM help_tickets
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC LIMIT $${values.length}`,
    values
  );
  return rows.map(summarize);
}

async function countMyTickets(userId, { status } = {}) {
  const conditions = [`(raised_by = $1 OR pc_accountable = $1 OR problem_solver = $1)`];
  const values = [userId];
  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM help_tickets WHERE ${conditions.join(' AND ')}`,
    values
  );
  return rows[0]?.n ?? 0;
}

module.exports = { getMyTickets, countMyTickets, _summarize: summarize };
