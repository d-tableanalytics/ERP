/**
 * Structured JSON logger for the chatbot module.
 * Emits one JSON line per call so logs can be ingested by any log collector.
 * Falls back to plain console formatting when LOG_FORMAT=plain.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL = LEVELS[(process.env.CHATBOT_LOG_LEVEL || 'info').toLowerCase()] || LEVELS.info;
const FORMAT = (process.env.CHATBOT_LOG_FORMAT || 'json').toLowerCase();

function emit(level, payload) {
  if (LEVELS[level] < MIN_LEVEL) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    scope: 'chatbot',
    ...payload,
  };
  if (FORMAT === 'plain') {
    const { ts, scope, message, ...rest } = line;
    const restStr = Object.keys(rest).length ? ' ' + JSON.stringify(rest) : '';
    const writer = level === 'error' || level === 'warn' ? console.error : console.log;
    writer(`[${ts}] [${scope}] [${level}] ${message || ''}${restStr}`);
  } else {
    const writer = level === 'error' || level === 'warn' ? console.error : console.log;
    writer(JSON.stringify(line));
  }
}

function child(bindings = {}) {
  return {
    debug: (msg, extra = {}) => emit('debug', { ...bindings, ...extra, message: msg }),
    info:  (msg, extra = {}) => emit('info',  { ...bindings, ...extra, message: msg }),
    warn:  (msg, extra = {}) => emit('warn',  { ...bindings, ...extra, message: msg }),
    error: (msg, extra = {}) => emit('error', { ...bindings, ...extra, message: msg }),
    child: (more) => child({ ...bindings, ...more }),
  };
}

module.exports = child();
module.exports.child = child;
