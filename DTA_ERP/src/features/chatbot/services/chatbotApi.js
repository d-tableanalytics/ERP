import api from '../../../services/api';
import { API_BASE_URL } from '../../../config';

const SESSION_KEY = 'erp.chatbot.sessionId';

/**
 * Chatbot API — handles communication with the v2 backend (orchestrator + SSE).
 */
class ChatbotApi {
  getSessionId() {
    try { return localStorage.getItem(SESSION_KEY) || null; } catch (_) { return null; }
  }
  setSessionId(id) {
    if (!id) return;
    try { localStorage.setItem(SESSION_KEY, id); } catch (_) { /* noop */ }
  }
  clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (_) { /* noop */ }
  }

  /**
   * Non-streaming JSON message — used as a fallback if streaming fails.
   */
  async sendMessage(message) {
    const sessionId = this.getSessionId();
    const t0 = performance.now();
    console.log('[chatbot.api] POST /api/chatbot/message', {
      messagePreview: String(message || '').slice(0, 80),
      sessionId,
    });
    try {
      const { data } = await api.post('/chatbot/message', { message, sessionId });
      const dt = Math.round(performance.now() - t0);
      console.log('[chatbot.api] /message ←', dt + 'ms', {
        success: data?.success,
        intent: data?.intent,
        responseType: data?.responseType,
        cards: data?.cards?.length || 0,
      });
      if (data?.sessionId) this.setSessionId(data.sessionId);
      if (!data || !data.success) throw new Error(data?.message || 'Failed to get response');
      return data;
    } catch (err) {
      const status = err?.response?.status;
      const body = err?.response?.data;
      console.error('[chatbot.api] /message failed', {
        status,
        body,
        message: err?.message,
      });
      const reason = body?.message || body?.error?.message || err?.message || 'Request failed';
      const e = new Error(status ? `(${status}) ${reason}` : reason);
      e.cause = err;
      throw e;
    }
  }

  /**
   * Streaming message via SSE (fetch + ReadableStream because EventSource
   * can't send the Authorization header).
   *
   * @param {string} message
   * @param {object} handlers
   *   onStart   (data)
   *   onDelta   (text)
   *   onToolCall(data), onToolResult(data), onCard(card)
   *   onDone    (envelope)
   *   onError   (envelopeOrError)
   * @returns {Promise<{ abort: () => void }>}
   */
  async streamMessage(message, handlers = {}) {
    const sessionId = this.getSessionId();
    const token = readToken();
    const url = `${API_BASE_URL}/api/chatbot/stream`;
    const t0 = performance.now();

    console.log('[chatbot.api] POST', url, {
      messagePreview: String(message || '').slice(0, 80),
      sessionId,
      hasToken: !!token,
    });
    if (!token) {
      console.warn('[chatbot.api] no auth token in localStorage; SSE will 401');
    }

    const controller = new AbortController();
    let finalEnvelope = null;
    let eventCount = 0;

    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message, sessionId }),
      });

      console.log('[chatbot.api] stream headers received', {
        status: response.status,
        ok: response.ok,
        contentType: response.headers.get('content-type'),
        ms: Math.round(performance.now() - t0),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        let parsed;
        try { parsed = JSON.parse(errText); } catch (_) { /* keep as text */ }
        const reason =
          parsed?.message ||
          parsed?.error?.message ||
          errText ||
          response.statusText;
        const error = new Error(`(${response.status}) ${reason}`);
        error.status = response.status;
        error.body = parsed || errText;
        throw error;
      }
      if (!response.body) throw new Error('No response body (browser does not support streaming)');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buf = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const evt = parseSSE(raw);
          if (!evt) continue;
          eventCount += 1;
          dispatchSSE(evt, handlers, (env) => {
            if (env?.sessionId) this.setSessionId(env.sessionId);
            finalEnvelope = env;
          });
        }
      }

      console.log('[chatbot.api] stream closed', {
        events: eventCount,
        hasFinal: !!finalEnvelope,
        ms: Math.round(performance.now() - t0),
      });

      if (!finalEnvelope) {
        handlers.onError?.({ success: false, message: 'Stream ended without a final envelope' });
      }
      return finalEnvelope;
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn('[chatbot.api] stream aborted');
        return null;
      }
      console.error('[chatbot.api] stream failed', {
        message: err.message,
        status: err.status,
        body: err.body,
        ms: Math.round(performance.now() - t0),
      });
      handlers.onError?.({
        success: false,
        message: err.message,
        error: { code: err.status || 'STREAM_ERROR', message: err.message },
      });
      throw err;
    }
  }

  /**
   * Get message history for a session (or recent across all if omitted).
   */
  async getHistory(sessionId = null, { limit = 50 } = {}) {
    const path = sessionId ? `/chatbot/history/${sessionId}` : '/chatbot/history';
    const { data } = await api.get(path, { params: { limit } });
    return data;
  }

  /**
   * List the user's sessions.
   */
  async listSessions(limit = 20) {
    const { data } = await api.get('/chatbot/sessions', { params: { limit } });
    return data;
  }

  /**
   * Delete a session (and its messages).
   */
  async clearSessionRemote(sessionId) {
    if (!sessionId) return;
    await api.delete(`/chatbot/sessions/${sessionId}`);
    if (this.getSessionId() === sessionId) this.clearSession();
  }
}

function readToken() {
  try {
    const direct = localStorage.getItem('token');
    if (direct) return direct;
    const auth = JSON.parse(localStorage.getItem('auth') || 'null');
    if (auth?.token) return auth.token;
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return user?.token || user?.user?.token || '';
  } catch (_) { return ''; }
}

function parseSSE(raw) {
  let event = 'message';
  const dataLines = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
    // ignore id:, retry:, comments
  }
  if (dataLines.length === 0) return null;
  const payload = dataLines.join('\n');
  let data;
  try { data = JSON.parse(payload); } catch (_) { data = payload; }
  return { event, data };
}

function dispatchSSE(evt, handlers, captureEnvelope) {
  switch (evt.event) {
    case 'start':       handlers.onStart?.(evt.data); break;
    case 'delta':       handlers.onDelta?.(evt.data?.text || ''); break;
    case 'tool_call':   handlers.onToolCall?.(evt.data); break;
    case 'tool_result': handlers.onToolResult?.(evt.data); break;
    case 'card':        handlers.onCard?.(evt.data); break;
    case 'done':        captureEnvelope(evt.data); handlers.onDone?.(evt.data); break;
    case 'error':       handlers.onError?.(evt.data); break;
    default: break;
  }
}

const chatbotApi = new ChatbotApi();
export default chatbotApi;
