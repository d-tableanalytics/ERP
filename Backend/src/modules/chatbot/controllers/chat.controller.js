const orchestrator = require('../services/ChatOrchestrator');
const logger = require('../utils/logger');
const { FALLBACK_MESSAGES, ErrorCode } = require('../constants/errors');

/**
 * POST /api/chatbot/message
 * Body: { message: string, sessionId?: uuid }
 */
exports.handleMessage = async function (req, res) {
  const log = logger.child({ requestId: req.requestId, controller: 'chat' });
  try {
    const { message, sessionId } = req.body || {};
    log.debug('handleMessage start', {
      messageLen: typeof message === 'string' ? message.length : null,
      sessionId,
    });

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      log.warn('rejected: empty message');
      return res.status(400).json({
        success: false,
        message: 'Message is required and cannot be empty',
      });
    }
    if (message.length > 1000) {
      log.warn('rejected: message too long', { len: message.length });
      return res.status(400).json({
        success: false,
        message: 'Message is too long (maximum 1000 characters)',
      });
    }

    const envelope = await orchestrator.run({
      message,
      user: req.user,
      sessionId,
    });

    log.info('handleMessage ok', {
      intent: envelope.intent,
      responseType: envelope.responseType,
      cards: envelope.cards?.length || 0,
      tools: envelope.toolsInvoked,
    });

    // Back-compat: include legacy `message` field so old clients keep working.
    return res.json({ ...envelope, message: envelope.text });
  } catch (err) {
    log.error('handleMessage failed', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      message: FALLBACK_MESSAGES[ErrorCode.INTERNAL],
      error: { code: ErrorCode.INTERNAL, message: err.message },
    });
  }
};
