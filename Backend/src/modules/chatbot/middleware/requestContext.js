const { randomUUID } = require('crypto');
const logger = require('../utils/logger');

/**
 * Attach a requestId + start timestamp to every chatbot request so
 * downstream logs and the envelope can correlate.
 * Also logs the incoming request and emits a single line on response close.
 */
module.exports = function requestContext(req, res, next) {
  req.requestId = req.headers['x-request-id'] || randomUUID();
  req.requestStart = Date.now();

  const userId = req.user?.user_id ?? req.user?.id ?? req.user?.User_Id;
  const role = req.user?.role;

  logger.info('▶ request', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    userId,
    role,
    bodyKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body) : null,
    messageLen: typeof req.body?.message === 'string' ? req.body.message.length : null,
    sessionId: req.body?.sessionId || null,
  });

  res.on('close', () => {
    logger.info('◀ response close', {
      requestId: req.requestId,
      status: res.statusCode,
      totalMs: Date.now() - req.requestStart,
    });
  });

  next();
};
