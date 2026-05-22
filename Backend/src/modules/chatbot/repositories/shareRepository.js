const crypto = require('crypto');
const db = require('../../../config/db.config');

const TOKEN_BYTES = 24;
const DEFAULT_EXPIRY_DAYS = 30;

function createShareToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}

async function create(sessionId, userId, expiryDays = DEFAULT_EXPIRY_DAYS) {
  const shareToken = createShareToken();
  const shareHash = hashToken(shareToken);

  const { rows } = await db.query(
    `INSERT INTO chatbot_share_links
       (share_hash, session_id, created_by, expires_at)
     VALUES ($1, $2, $3, NOW() + ($4::int * INTERVAL '1 day'))
     RETURNING id, session_id, expires_at AT TIME ZONE 'UTC' AS expires_at`,
    [shareHash, sessionId, userId, expiryDays]
  );

  return { ...rows[0], shareToken };
}

async function findByToken(shareToken) {
  const { rows } = await db.query(
    `SELECT sl.id,
            sl.session_id,
            sl.created_by,
            sl.is_active,
            sl.revoked_at,
            sl.expires_at,
            sl.expires_at AT TIME ZONE 'UTC' AS expires_at_utc,
            s.title,
            s.created_at AT TIME ZONE 'UTC' AS session_created_at,
            s.last_activity AT TIME ZONE 'UTC' AS session_last_activity
       FROM chatbot_share_links sl
       JOIN chatbot_sessions s ON s.session_id = sl.session_id
      WHERE sl.share_hash = $1
      LIMIT 1`,
    [hashToken(shareToken)]
  );
  return rows[0] || null;
}

async function revokeForSession(sessionId, userId) {
  const { rowCount } = await db.query(
    `UPDATE chatbot_share_links
        SET is_active = FALSE,
            revoked_at = NOW(),
            updated_at = NOW()
      WHERE session_id = $1
        AND created_by = $2
        AND is_active = TRUE
        AND revoked_at IS NULL`,
    [sessionId, userId]
  );
  return rowCount;
}

module.exports = { create, findByToken, revokeForSession };
