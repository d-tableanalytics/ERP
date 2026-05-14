const sessionStore = require('../memory/SessionStore');
const messageRepo = require('../repositories/messageRepository');
const { resolveUserId } = require('../validators/permissions');
const logger = require('../utils/logger');

const log = logger.child({ controller: 'history' });

/**
 * GET /api/chatbot/sessions
 */
exports.listSessions = async function (req, res) {
  try {
    const userId = resolveUserId(req.user);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    log.info('listSessions', { requestId: req.requestId, userId, limit });
    const sessions = await sessionStore.listSessions(userId, limit);
    return res.json({ success: true, sessions });
  } catch (err) {
    log.error('listSessions failed', { requestId: req.requestId, error: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/chatbot/history/:sessionId
 */
exports.getHistory = async function (req, res) {
  try {
    const userId = resolveUserId(req.user);
    const { sessionId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    log.info('getHistory', { requestId: req.requestId, userId, sessionId, limit, offset });

    if (!sessionId) {
      const messages = await messageRepo.listForUser(userId, null, limit, offset);
      return res.json({ success: true, messages });
    }

    const session = await sessionStore.getSession(sessionId);
    if (!session || Number(session.user_id) !== Number(userId)) {
      log.warn('getHistory: session not found or owned', { requestId: req.requestId, sessionId });
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    const messages = await messageRepo.listForUser(userId, sessionId, limit, offset);
    return res.json({ success: true, sessionId, messages });
  } catch (err) {
    log.error('getHistory failed', { requestId: req.requestId, error: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE /api/chatbot/sessions/:sessionId
 */
exports.clearSession = async function (req, res) {
  try {
    const userId = resolveUserId(req.user);
    const { sessionId } = req.params;
    log.info('clearSession', { requestId: req.requestId, userId, sessionId });
    await sessionStore.clear(sessionId, userId);
    return res.json({ success: true });
  } catch (err) {
    log.error('clearSession failed', { requestId: req.requestId, error: err.message });
    return res.status(500).json({ success: false, message: err.message });
  }
};
