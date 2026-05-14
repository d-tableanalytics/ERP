const test = require('node:test');
const assert = require('node:assert/strict');

const orchestrator = require('../services/ChatOrchestrator');
const providerModule = require('../providers');
const sessionStore = require('../memory/SessionStore');
const registry = require('../tools/registry');

/**
 * Integration test for the orchestrator tool-loop using a mocked provider
 * and mocked session store. Verifies:
 *   - LLM tool call is dispatched
 *   - Tool result is fed back
 *   - Final assistant message is returned
 *   - Envelope contains expected shape
 */

function mockProvider({ scriptedResponses }) {
  let i = 0;
  return {
    chat: async () => scriptedResponses[i++],
    async *stream() { yield { type: 'done', content: '', toolCalls: [] }; },
    isAvailable: () => true,
    name: 'mock',
  };
}

function patchProvider(provider) {
  const original = providerModule.getProvider;
  providerModule.getProvider = () => provider;
  return () => { providerModule.getProvider = original; };
}

function patchSessionStore() {
  const slots = {};
  const turns = [];
  let nextMsgId = 1;
  let sessionId = '00000000-0000-0000-0000-000000000001';
  const originals = {
    getOrCreate: sessionStore.getOrCreate,
    loadHistory: sessionStore.loadHistory,
    mergeSlots: sessionStore.mergeSlots,
    logTurn: sessionStore.logTurn,
  };
  sessionStore.getOrCreate = async () => ({ session_id: sessionId, user_id: 5, context_json: slots });
  sessionStore.loadHistory = async () => [];
  sessionStore.mergeSlots = async (_sid, patch) => Object.assign(slots, patch);
  sessionStore.logTurn = async (row) => { turns.push(row); return { id: nextMsgId++ }; };
  return { slots, turns, restore: () => Object.assign(sessionStore, originals) };
}

function patchRegistry(name, fn) {
  const original = registry.HANDLERS[name];
  registry.HANDLERS[name] = fn;
  return () => { registry.HANDLERS[name] = original; };
}

function patchLegacyMirror() {
  // Swap the legacy mirror to no-op by patching db.query just for this test
  const db = require('../../../config/db.config');
  const orig = db.query;
  db.query = async () => ({ rows: [] });
  return () => { db.query = orig; };
}

test('orchestrator: single-hop tool call → final message', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      // First LLM turn: request a tool call
      {
        content: null,
        toolCalls: [{ id: 'call_1', name: 'countTasks', args: { status: 'Pending' } }],
        usage: { prompt_tokens: 50, completion_tokens: 5, total_tokens: 55 },
      },
      // Second LLM turn: produce final text (no tool calls)
      {
        content: 'You have **3 pending tasks**.',
        toolCalls: [],
        usage: { prompt_tokens: 80, completion_tokens: 8, total_tokens: 88 },
      },
    ],
  });

  const restoreProvider = patchProvider(provider);
  const session = patchSessionStore();
  const restoreTool = patchRegistry('countTasks', async () => ({ ok: true, count: 3 }));
  const restoreMirror = patchLegacyMirror();

  try {
    const envelope = await orchestrator.run({
      message: 'how many pending tasks',
      user: { user_id: 5, role: 'Employee', name: 'Test User' },
      sessionId: null,
    });
    assert.equal(envelope.success, true);
    assert.equal(envelope.text, 'You have **3 pending tasks**.');
    assert.equal(envelope.intent, 'task_count');
    assert.equal(envelope.responseType, 'count');
    assert.equal(envelope.toolsInvoked[0], 'countTasks');
    // History should record: user turn, tool turn, assistant turn
    const roles = session.turns.map((t) => t.role);
    assert.deepEqual(roles, ['user', 'tool', 'assistant']);
  } finally {
    restoreTool();
    session.restore();
    restoreProvider();
    restoreMirror();
  }
});

test('orchestrator: no tool call → direct answer', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      { content: 'Hello! How can I help you today?', toolCalls: [], usage: { prompt_tokens: 30, completion_tokens: 8, total_tokens: 38 } },
    ],
  });

  const restoreProvider = patchProvider(provider);
  const session = patchSessionStore();
  const restoreMirror = patchLegacyMirror();

  try {
    const envelope = await orchestrator.run({
      message: 'hi there',
      user: { user_id: 5, role: 'Employee' },
      sessionId: null,
    });
    assert.equal(envelope.success, true);
    assert.match(envelope.text, /hello/i);
    assert.equal(envelope.responseType, 'greeting');
    assert.equal(envelope.toolsInvoked.length, 0);
  } finally {
    session.restore();
    restoreProvider();
    restoreMirror();
  }
});

test('orchestrator: tool failure → envelope still ok with text from LLM', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      { content: null, toolCalls: [{ id: 'c1', name: 'getMyTasks', args: {} }], usage: {} },
      { content: "Sorry — I couldn't fetch your tasks right now. Please try again.", toolCalls: [], usage: {} },
    ],
  });

  const restoreProvider = patchProvider(provider);
  const session = patchSessionStore();
  const restoreTool = patchRegistry('getMyTasks', async () => { throw new Error('db down'); });
  const restoreMirror = patchLegacyMirror();

  try {
    const envelope = await orchestrator.run({
      message: 'show my tasks',
      user: { user_id: 5, role: 'Employee' },
      sessionId: null,
    });
    assert.equal(envelope.success, true);
    assert.match(envelope.text, /try again/i);
  } finally {
    restoreTool();
    session.restore();
    restoreProvider();
    restoreMirror();
  }
});
