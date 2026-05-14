const db = require('../../../config/db.config');

/**
 * Direct CRUD over chatbot_messages. One row per conversation turn
 * (user, assistant, or tool). Tool calls/results stored as JSONB for replay & analytics.
 */

async function insert(row) {
  const {
    sessionId,
    userId,
    role,
    content = null,
    toolCalls = null,
    toolName = null,
    toolResult = null,
    intent = null,
    confidence = null,
    tokensIn = null,
    tokensOut = null,
    latencyMs = null,
  } = row;

  const { rows } = await db.query(
    `INSERT INTO chatbot_messages
       (session_id, user_id, role, content, tool_calls, tool_name, tool_result,
        intent, confidence, tokens_in, tokens_out, latency_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id, created_at`,
    [
      sessionId,
      userId,
      role,
      content,
      toolCalls ? JSON.stringify(toolCalls) : null,
      toolName,
      toolResult ? JSON.stringify(toolResult) : null,
      intent,
      confidence,
      tokensIn,
      tokensOut,
      latencyMs,
    ]
  );
  return rows[0];
}

async function listRecent(sessionId, limit = 20) {
  const { rows } = await db.query(
    `SELECT id, role, content, tool_calls, tool_name, tool_result, intent, created_at
       FROM chatbot_messages
      WHERE session_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2`,
    [sessionId, limit]
  );
  return rows.reverse();
}

async function listForUser(userId, sessionId = null, limit = 50, offset = 0) {
  if (sessionId) {
    const { rows } = await db.query(
      `SELECT id, role, content, intent, created_at
         FROM chatbot_messages WHERE session_id = $1 AND user_id = $2
         ORDER BY created_at ASC LIMIT $3 OFFSET $4`,
      [sessionId, userId, limit, offset]
    );
    return rows;
  }
  const { rows } = await db.query(
    `SELECT id, session_id, role, content, intent, created_at
       FROM chatbot_messages WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows;
}

module.exports = { insert, listRecent, listForUser };
