const db = require('../../../config/db.config');
const sessionRepo = require('../repositories/sessionRepository');
const messageRepo = require('../repositories/messageRepository');
const shareRepo = require('../repositories/shareRepository');

async function createShareLink(sessionId, userId) {
  const session = await sessionRepo.get(sessionId);
  if (!session || Number(session.user_id) !== Number(userId)) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }

  await shareRepo.revokeForSession(sessionId, userId);
  return shareRepo.create(sessionId, userId);
}

async function loadSharedChat(shareToken, userId) {
  const member = await getActiveMember(userId);
  if (!member) {
    const err = new Error('Access denied');
    err.status = 403;
    throw err;
  }

  const share = await shareRepo.findByToken(shareToken);
  if (!share || !share.is_active || share.revoked_at) {
    const err = new Error('Chat share link not found');
    err.status = 404;
    throw err;
  }

  if (new Date(share.expires_at).getTime() <= Date.now()) {
    const err = new Error('Shared chat link expired');
    err.status = 404;
    throw err;
  }

  const messages = await messageRepo.listForSession(share.session_id, 200, 0);
  return {
    session: {
      session_id: share.session_id,
      title: share.title,
      created_at: share.session_created_at,
      last_activity: share.session_last_activity,
    },
    expiresAt: share.expires_at_utc,
    messages,
  };
}

async function revokeShareLink(sessionId, userId) {
  const session = await sessionRepo.get(sessionId);
  if (!session || Number(session.user_id) !== Number(userId)) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }

  await shareRepo.revokeForSession(sessionId, userId);
}

async function getActiveMember(userId) {
  if (!userId) return null;
  const { rows } = await db.query(
    `SELECT user_id, role
       FROM employees
      WHERE user_id = $1
        AND deleted_at IS NULL
      LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

module.exports = { createShareLink, loadSharedChat, revokeShareLink };
