const db = require('../../../config/db.config');

/**
 * Direct CRUD over chatbot_sessions. Sessions hold the conversation thread id
 * plus a JSONB slot bag (selectedTaskId, lastFilters, etc.) used for follow-ups.
 */

async function create(userId, title = null) {
  const { rows } = await db.query(
    `INSERT INTO chatbot_sessions (user_id, title) VALUES ($1, $2) RETURNING session_id, user_id, title, context_json, created_at, last_activity`,
    [userId, title]
  );
  return rows[0];
}

async function get(sessionId) {
  if (!sessionId) return null;
  const { rows } = await db.query(
    `SELECT session_id, user_id, title, context_json, created_at, last_activity
       FROM chatbot_sessions WHERE session_id = $1`,
    [sessionId]
  );
  return rows[0] || null;
}

async function getOrCreate(sessionId, userId) {
  if (sessionId) {
    const existing = await get(sessionId);
    if (existing && Number(existing.user_id) === Number(userId)) return existing;
  }
  return create(userId);
}

async function touch(sessionId) {
  await db.query(
    `UPDATE chatbot_sessions SET last_activity = NOW() WHERE session_id = $1`,
    [sessionId]
  );
}

async function updateContext(sessionId, contextPatch) {
  if (!contextPatch || Object.keys(contextPatch).length === 0) return;
  await db.query(
    `UPDATE chatbot_sessions
        SET context_json = COALESCE(context_json,'{}'::jsonb) || $2::jsonb,
            last_activity = NOW()
      WHERE session_id = $1`,
    [sessionId, JSON.stringify(contextPatch)]
  );
}

async function listForUser(userId, limit = 20) {
  const { rows } = await db.query(
    `SELECT session_id, title, last_activity, created_at
       FROM chatbot_sessions WHERE user_id = $1
       ORDER BY last_activity DESC LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

async function remove(sessionId, userId) {
  await db.query(
    `DELETE FROM chatbot_sessions WHERE session_id = $1 AND user_id = $2`,
    [sessionId, userId]
  );
}

module.exports = { create, get, getOrCreate, touch, updateContext, listForUser, remove };
