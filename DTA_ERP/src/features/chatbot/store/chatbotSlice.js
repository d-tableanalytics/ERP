import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import chatbotApi from '../services/chatbotApi';

/**
 * Streaming-aware message thunk. We dispatch reducer actions throughout the
 * stream so the UI can show the response as it's generated.
 */
export const sendMessageStream = createAsyncThunk(
  'chatbot/sendMessageStream',
  async (message, { dispatch, rejectWithValue }) => {
    const turnStart = performance.now();
    const userTurnId = `u-${Date.now()}`;
    const botTurnId = `b-${Date.now() + 1}`;

    console.log('[chatbot] ▶ sendMessageStream', {
      messagePreview: String(message || '').slice(0, 120),
      length: (message || '').length,
      sessionId: chatbotApi.getSessionId(),
    });

    // Append the user message immediately for snappy UX.
    dispatch(addMessage({
      id: userTurnId,
      text: message,
      sender: 'user',
      timestamp: new Date().toISOString(),
    }));

    // We lazily create the bot bubble on first delta/card/done. Until then the
    // TypingIndicator is shown — no awkward empty bubble.
    let botCreated = false;
    const ensureBotMessage = () => {
      if (botCreated) return;
      dispatch(addMessage({
        id: botTurnId,
        text: '',
        sender: 'bot',
        streaming: true,
        cards: [],
        quickActions: [],
        suggestions: [],
        timestamp: new Date().toISOString(),
      }));
      botCreated = true;
    };

    try {
      const envelope = await chatbotApi.streamMessage(message, {
        onStart: (data) => console.log('[chatbot] ◆ stream start', data),
        onDelta: (text) => {
          if (text && text.length > 30) console.debug('[chatbot] · delta', text.length, 'chars');
          ensureBotMessage();
          dispatch(appendDelta({ id: botTurnId, text }));
        },
        onCard: (card) => {
          console.log('[chatbot] ▣ card', card?.type, card?.id || card?.title);
          ensureBotMessage();
          dispatch(attachCard({ id: botTurnId, card }));
        },
        onToolCall: (data) => {
          console.log('[chatbot] ⚙ tool_call', data?.name, data?.args);
          // Don't create the bot bubble yet — tool calls happen before the answer.
          // The TypingIndicator stays visible.
        },
        onToolResult: (data) => {
          console.log('[chatbot] ✓ tool_result', data?.name, data?.ok, data?.latencyMs + 'ms');
        },
        onDone: (env) => {
          const ms = Math.round(performance.now() - turnStart);
          console.log('[chatbot] ✔ done in', ms + 'ms', {
            intent: env?.intent,
            responseType: env?.responseType,
            cards: env?.cards?.length,
            toolsInvoked: env?.toolsInvoked,
          });
          ensureBotMessage();
          dispatch(finalizeMessage({ id: botTurnId, envelope: env }));
        },
        onError: (env) => {
          console.error('[chatbot] ✖ stream error event', env);
          ensureBotMessage();
          dispatch(failMessage({ id: botTurnId, envelope: env }));
        },
      });

      if (envelope?.sessionId) dispatch(setSessionId(envelope.sessionId));
      return envelope;
    } catch (err) {
      console.warn('[chatbot] stream threw; falling back to JSON endpoint', {
        name: err?.name,
        message: err?.message,
      });
      try {
        const data = await chatbotApi.sendMessage(message);
        const ms = Math.round(performance.now() - turnStart);
        console.log('[chatbot] ✔ fallback succeeded in', ms + 'ms', { intent: data?.intent });
        ensureBotMessage();
        dispatch(finalizeMessage({ id: botTurnId, envelope: data }));
        if (data?.sessionId) dispatch(setSessionId(data.sessionId));
        return data;
      } catch (fallbackErr) {
        console.error('[chatbot] ✖ both stream and fallback failed', {
          streamErr: err?.message,
          fallbackErr: fallbackErr?.message,
        });
        ensureBotMessage();
        dispatch(failMessage({
          id: botTurnId,
          envelope: {
            text: 'Sorry, I couldn\'t reach the assistant.',
            error: { message: fallbackErr.message || err.message || 'Network error' },
          },
        }));
        return rejectWithValue(fallbackErr.message || err.message);
      }
    }
  }
);

/**
 * Hydrate a session's message history (used when reopening the drawer).
 */
export const loadHistory = createAsyncThunk(
  'chatbot/loadHistory',
  async (sessionId, { rejectWithValue }) => {
    try {
      const data = await chatbotApi.getHistory(sessionId);
      return data;
    } catch (e) {
      return rejectWithValue(e.message);
    }
  }
);

const initialState = {
  messages: [],
  isOpen: false,
  isTyping: false,
  error: null,
  sessionId: chatbotApi.getSessionId() || null,
};

const chatbotSlice = createSlice({
  name: 'chatbot',
  initialState,
  reducers: {
    toggleChatbot: (s) => { s.isOpen = !s.isOpen; },
    closeChatbot: (s) => { s.isOpen = false; },
    addMessage: (s, a) => { s.messages.push(a.payload); },
    clearMessages: (s) => { s.messages = []; },
    setTyping: (s, a) => { s.isTyping = a.payload; },
    clearError: (s) => { s.error = null; },
    setSessionId: (s, a) => {
      s.sessionId = a.payload;
      chatbotApi.setSessionId(a.payload);
    },
    resetSession: (s) => {
      s.messages = [];
      s.sessionId = null;
      chatbotApi.clearSession();
    },
    appendDelta: (s, a) => {
      const msg = s.messages.find((m) => m.id === a.payload.id);
      if (msg) msg.text = (msg.text || '') + (a.payload.text || '');
    },
    attachCard: (s, a) => {
      const msg = s.messages.find((m) => m.id === a.payload.id);
      if (msg) {
        msg.cards = msg.cards || [];
        msg.cards.push(a.payload.card);
      }
    },
    noteToolCall: (s, a) => {
      const msg = s.messages.find((m) => m.id === a.payload.id);
      if (msg) {
        msg.toolCalls = msg.toolCalls || [];
        msg.toolCalls.push(a.payload.data?.name || 'tool');
      }
    },
    finalizeMessage: (s, a) => {
      const msg = s.messages.find((m) => m.id === a.payload.id);
      const env = a.payload.envelope || {};
      if (msg) {
        msg.streaming = false;
        msg.text = env.text || msg.text || '';
        msg.cards = env.cards || msg.cards || [];
        msg.quickActions = env.quickActions || [];
        msg.suggestions = env.suggestions || [];
        msg.intent = env.intent;
        msg.responseType = env.responseType;
      }
    },
    failMessage: (s, a) => {
      const env = a.payload.envelope || {};
      // Real error details may live in any of these fields depending on the
      // failure layer (fetch-level vs. orchestrator-level vs. fallback).
      const reason =
        env.error?.message ||
        env.message ||
        env.text ||
        'Stream failed';
      const msg = s.messages.find((m) => m.id === a.payload.id);
      if (msg) {
        msg.streaming = false;
        msg.text = env.text || `Sorry — ${reason}`;
        msg.error = true;
      }
      s.error = reason;
      // Helpful debug breadcrumb in the browser console
      // eslint-disable-next-line no-console
      console.error('[chatbot] failMessage', { reason, envelope: env });
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendMessageStream.pending, (s) => { s.isTyping = true; s.error = null; })
      .addCase(sendMessageStream.fulfilled, (s) => { s.isTyping = false; })
      .addCase(sendMessageStream.rejected, (s, a) => { s.isTyping = false; s.error = a.payload || 'Failed'; })
      .addCase(loadHistory.fulfilled, (s, a) => {
        const rows = a.payload?.messages || [];
        s.messages = rows
          .filter((r) => r.role === 'user' || r.role === 'assistant')
          .map((r, i) => ({
            id: `h-${r.id || i}`,
            text: r.content || '',
            sender: r.role === 'user' ? 'user' : 'bot',
            timestamp: r.created_at,
            intent: r.intent,
          }));
        if (a.payload?.sessionId) s.sessionId = a.payload.sessionId;
      });
  },
});

// Keep the old sendMessage thunk name as an alias for backward compatibility.
export const sendMessage = sendMessageStream;

export const {
  toggleChatbot,
  closeChatbot,
  addMessage,
  clearMessages,
  setTyping,
  clearError,
  setSessionId,
  resetSession,
  appendDelta,
  attachCard,
  noteToolCall,
  finalizeMessage,
  failMessage,
} = chatbotSlice.actions;

export default chatbotSlice.reducer;
