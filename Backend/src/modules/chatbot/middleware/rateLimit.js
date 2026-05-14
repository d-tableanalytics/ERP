const { ErrorCode, FALLBACK_MESSAGES } = require('../constants/errors');
const logger = require('../utils/logger');

/**
 * In-process token-bucket rate limiter per user_id.
 * Default: 0.5 tokens/sec, capacity 30 (i.e. 30 burst, ~1 per 2s sustained).
 * Override via CHATBOT_RATE_LIMIT="ratePerSec:capacity".
 */

function parseConfig() {
  const env = (process.env.CHATBOT_RATE_LIMIT || '0.5:30').trim();
  const [rateStr, capStr] = env.split(':');
  const ratePerSec = parseFloat(rateStr) || 0.5;
  const capacity = parseInt(capStr, 10) || 30;
  return { ratePerSec, capacity };
}

const { ratePerSec, capacity } = parseConfig();
const buckets = new Map();

function take(userId) {
  const now = Date.now();
  const bucket = buckets.get(userId) || { tokens: capacity, last: now };
  const elapsedSec = (now - bucket.last) / 1000;
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSec * ratePerSec);
  bucket.last = now;
  if (bucket.tokens < 1) {
    buckets.set(userId, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(userId, bucket);
  return true;
}

module.exports = function rateLimit(req, res, next) {
  const uid = req.user?.user_id ?? req.user?.id ?? req.user?.User_Id;
  if (!uid) return next();
  if (!take(uid)) {
    logger.warn('rate limit hit', { requestId: req.requestId, userId: uid });
    return res.status(429).json({
      success: false,
      message: FALLBACK_MESSAGES[ErrorCode.RATE_LIMITED],
      error: { code: ErrorCode.RATE_LIMITED },
    });
  }
  next();
};
