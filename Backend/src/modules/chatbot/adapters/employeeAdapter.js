const db = require('../../../config/db.config');
const { bestMatch } = require('../utils/fuzzy');

/**
 * Employee adapter — admin-only fuzzy search by name.
 */

function summarize(row) {
  if (!row) return null;
  const name = `${row.first_name || ''} ${row.last_name || ''}`.trim();
  return {
    id: row.user_id,
    name,
    email: row.work_email,
    designation: row.designation || null,
    department: row.department || null,
    role: row.role || 'Employee',
  };
}

async function search(query, { limit = 5 } = {}) {
  if (!query) return [];
  const ilike = `%${String(query).trim()}%`;
  const { rows } = await db.query(
    `SELECT user_id, first_name, last_name, work_email, designation, department, role
       FROM employees
      WHERE deleted_at IS NULL
        AND (LOWER(first_name || ' ' || COALESCE(last_name,'')) ILIKE LOWER($1)
             OR LOWER(work_email) ILIKE LOWER($1))
      LIMIT 25`,
    [ilike]
  );
  if (rows.length === 0) {
    // Fallback: broaden then fuzzy rank locally.
    const broad = await db.query(
      `SELECT user_id, first_name, last_name, work_email, designation, department, role
         FROM employees WHERE deleted_at IS NULL LIMIT 200`
    );
    const ranked = broad.rows
      .map((r) => ({ r, score: bestScore(query, r) }))
      .filter((x) => x.score > 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.r);
    return ranked.map(summarize);
  }
  return rows.slice(0, limit).map(summarize);
}

function bestScore(query, employee) {
  const name = `${employee.first_name || ''} ${employee.last_name || ''}`;
  const candidates = [name, employee.work_email];
  let best = 0;
  for (const c of candidates) {
    const m = bestMatch(query, [c]);
    if (m && m.score > best) best = m.score;
  }
  return best;
}

async function findById(userId) {
  const { rows } = await db.query(
    `SELECT user_id, first_name, last_name, work_email, designation, department, role
       FROM employees WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  return summarize(rows[0]);
}

module.exports = { search, findById, _summarize: summarize };
