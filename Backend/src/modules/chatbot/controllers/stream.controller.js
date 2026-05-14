const orchestrator = require('../services/ChatOrchestrator');
const logger = require('../utils/logger');

/**
 * POST /api/chatbot/stream (SSE)
 *
 * Events: start, tool_call, tool_result, delta, card, done, error
 * Client reads via fetch + ReadableStream (EventSource won't carry JWT).
 *
 * Proxy-friendly: we send a 2KB SSE comment immediately so reverse proxies
 * (Vite dev-server, nginx default) flush the response buffer and the browser
 * starts receiving events in real time. A heartbeat comment keeps the
 * connection alive on slow turns.
 */
exports.streamMessage = async function (req, res) {
  const log = logger.child({ requestId: req.requestId, controller: 'stream' });
  const { message, sessionId } = req.body || {};

  log.info('stream entry', {
    messageLen: typeof message === 'string' ? message.length : null,
    sessionId,
    userId: req.user?.user_id ?? req.user?.id,
  });

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    log.warn('rejected: empty message');
    return res.status(400).json({ success: false, message: 'Message is required' });
  }
  if (message.length > 1000) {
    log.warn('rejected: message too long', { len: message.length });
    return res.status(400).json({ success: false, message: 'Message is too long (maximum 1000 characters)' });
  }

  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  // Disable Nagle on the underlying socket so small writes don't sit in TCP buffer.
  if (res.socket && typeof res.socket.setNoDelay === 'function') {
    try { res.socket.setNoDelay(true); } catch (_) { /* ignore */ }
  }

  // 2KB padding comment → forces proxies (Vite/nginx) to flush. The colon-prefixed
  // line is a valid SSE comment that clients ignore.
  try {
    res.write(':' + ' '.repeat(2048) + '\n\n');
    if (typeof res.flush === 'function') res.flush();
  } catch (err) {
    log.warn('initial padding write failed', { error: err.message });
  }

  let closed = false;
  let eventCount = 0;
  let skipped = 0;

  // IMPORTANT: listen on res, not req. In Express 5, the request stream's
  // 'close' event can fire as soon as express.json() finishes consuming the
  // body — which would mark us closed before we've written any deltas.
  // res.on('close') only fires when the actual connection is closed.
  res.on('close', () => {
    closed = true;
    log.info('connection closed', { events: eventCount, skipped });
  });
  res.on('error', (err) => {
    log.warn('response error', { error: err.message });
  });

  const send = (event, data) => {
    if (closed) {
      skipped += 1;
      return;
    }
    eventCount += 1;
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (typeof res.flush === 'function') res.flush();
    } catch (err) {
      log.warn('SSE write failed', { event, error: err.message });
    }
  };

  // Heartbeat every 15s so dev proxies don't drop the connection on slow turns.
  const heartbeat = setInterval(() => {
    if (closed) return;
    try {
      res.write(': heartbeat\n\n');
      if (typeof res.flush === 'function') res.flush();
    } catch (_) { /* ignore */ }
  }, 15000);

  try {
    send('start', { sessionId: sessionId || null, requestId: req.requestId });
    log.debug('stream started');

    await orchestrator.runStream(
      { message, user: req.user, sessionId },
      {
        onToolCall: (tc) => { log.debug('emit tool_call', { name: tc.name }); send('tool_call', tc); },
        onToolResult: (tr) => { log.debug('emit tool_result', { name: tr.name, ok: tr.ok, ms: tr.latencyMs }); send('tool_result', tr); },
        onDelta: (text) => send('delta', { text }),
        onCard: (card) => { log.debug('emit card', { type: card?.type }); send('card', card); },
        onDone: (envelope) => {
          log.info('emit done', {
            intent: envelope.intent,
            responseType: envelope.responseType,
            cards: envelope.cards?.length || 0,
            tools: envelope.toolsInvoked,
            events: eventCount,
          });
          send('done', envelope);
        },
        onError: (envelope) => {
          log.warn('emit error', { error: envelope.error });
          send('error', envelope);
        },
      }
    );
  } catch (err) {
    log.error('stream controller failure', { error: err.message, stack: err.stack });
    send('error', {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
      message: err.message,
    });
  } finally {
    clearInterval(heartbeat);
    if (!closed) {
      try { res.end(); } catch (_) { /* ignore */ }
    }
  }
};
