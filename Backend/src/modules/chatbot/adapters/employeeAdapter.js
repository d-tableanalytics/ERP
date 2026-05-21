const db = require('../../../config/db.config');
const { bestMatch } = require('../utils/fuzzy');

/**
 * Employee adapter — admin-only fuzzy search by name.
 */

function summarize(row) {
  if (!row) return null;
  const name = properName(`${row.first_name || ''} ${row.last_name || ''}`);
  return {
    id: row.user_id,
    name,
    email: row.work_email,
    designation: row.designation || null,
    department: row.department || null,
    role: row.role || 'Employee',
  };
}

function properName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((part) => part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : '')
    .join(' ');
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

async function findByIds(userIds = []) {
  const ids = [...new Set((userIds || []).map((id) => Number(id)).filter(Number.isInteger))];
  if (ids.length === 0) return [];
  const { rows } = await db.query(
    `SELECT user_id, first_name, last_name, work_email, designation, department, role
       FROM employees
      WHERE user_id = ANY($1::int[]) AND deleted_at IS NULL`,
    [ids]
  );
  const byId = new Map(rows.map((row) => [row.user_id, summarize(row)]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

async function listAll({ limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const { rows } = await db.query(
    `SELECT user_id, first_name, last_name, work_email, designation, department, role
       FROM employees
      WHERE deleted_at IS NULL
      ORDER BY first_name ASC, last_name ASC
      LIMIT $1`,
    [safeLimit]
  );
  return rows.map(summarize);
}

module.exports = { search, findById, findByIds, listAll, _summarize: summarize };
