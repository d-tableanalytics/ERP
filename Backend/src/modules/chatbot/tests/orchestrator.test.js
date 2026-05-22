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

test('orchestrator: delete checklist phrase does not delete task', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      { content: null, toolCalls: [{ id: 'delete_1', name: 'deleteTask', args: { taskTitle: 'testing' } }], usage: {} },
      { content: 'unused', toolCalls: [], usage: {} },
    ],
  });

  let checklistArgs;
  let taskCalled = false;
  const restoreProvider = patchProvider(provider);
  const session = patchSessionStore();
  const restoreChecklist = patchRegistry('deleteChecklist', async (args) => {
    checklistArgs = args;
    return { ok: true, checklistId: 12, checklistName: 'Website Testing' };
  });
  const restoreTask = patchRegistry('deleteTask', async () => {
    taskCalled = true;
    return { ok: true, taskTitle: 'testing' };
  });
  const restoreMirror = patchLegacyMirror();

  try {
    const envelope = await orchestrator.run({
      message: 'delete website testing checklist',
      user: { user_id: 5, role: 'Employee', name: 'Test User' },
      sessionId: null,
    });

    assert.equal(taskCalled, false);
    assert.deepEqual(envelope.toolsInvoked, ['deleteChecklist']);
    assert.equal(checklistArgs.name, 'website testing');
    assert.equal(envelope.text, 'Checklist "Website Testing" deleted successfully.');
    assert.doesNotMatch(envelope.text, /^Task /);
  } finally {
    restoreTask();
    restoreChecklist();
    session.restore();
    restoreProvider();
    restoreMirror();
  }
});

test('orchestrator: accidental checklist completion asks for restore status without delete', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      { content: 'provider should not be used', toolCalls: [], usage: {} },
    ],
  });

  const db = require('../../../config/db.config');
  const originalQuery = db.query;
  const restoreMirror = patchLegacyMirror();
  const queries = [];
  db.query = async (sql, params) => {
    queries.push({ sql, params });
    if (/FROM checklist c/i.test(sql)) {
      return {
        rows: [
          { id: 44, question: 'ERP Validation Work', status: 'Completed' },
        ],
      };
    }
    return { rows: [] };
  };

  const restoreProvider = patchProvider(provider);
  const session = patchSessionStore();
  let deleteTaskCalled = false;
  let deleteChecklistCalled = false;
  const restoreTask = patchRegistry('deleteTask', async () => {
    deleteTaskCalled = true;
    return { ok: true };
  });
  const restoreChecklist = patchRegistry('deleteChecklist', async () => {
    deleteChecklistCalled = true;
    return { ok: true };
  });

  try {
    const envelope = await orchestrator.run({
      message: 'Mistakenly I completed this checklist - ERP Validation Work',
      user: { user_id: 5, role: 'Employee', name: 'Test User' },
      sessionId: null,
    });

    assert.equal(deleteTaskCalled, false);
    assert.equal(deleteChecklistCalled, false);
    assert.equal(envelope.intent, 'restoreStatus');
    assert.match(envelope.text, /No problem 😊 I can change the status back for you\./);
    assert.match(envelope.text, /Checklist: ERP Validation Work/);
    assert.match(envelope.text, /Current Status: Completed/);
    assert.deepEqual(envelope.quickActions.map((action) => action.label), ['Pending', 'In Progress', 'Hold']);
    assert.equal(session.slots.pendingAction, 'restoreStatus');
    assert.equal(session.slots.targetType, 'checklist');
    assert.equal(session.slots.targetId, 44);
    assert.equal(queries.some((query) => /DELETE FROM checklist/i.test(query.sql)), false);
  } finally {
    restoreChecklist();
    restoreTask();
    restoreMirror();
    session.restore();
    restoreProvider();
    db.query = originalQuery;
  }
});

test('orchestrator: restore status selection updates checklist status', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      { content: 'provider should not be used', toolCalls: [], usage: {} },
    ],
  });

  const db = require('../../../config/db.config');
  const originalQuery = db.query;
  const restoreMirror = patchLegacyMirror();
  const queries = [];
  db.query = async (sql, params) => {
    queries.push({ sql, params });
    if (/SELECT id, question, status/i.test(sql)) {
      return {
        rows: [
          { id: 44, question: 'ERP Validation Work', status: 'Completed' },
        ],
      };
    }
    if (/UPDATE checklist/i.test(sql)) {
      return {
        rows: [
          { id: 44, question: 'ERP Validation Work', status: 'Pending' },
        ],
      };
    }
    return { rows: [] };
  };

  const restoreProvider = patchProvider(provider);
  const session = patchSessionStore();
  Object.assign(session.slots, {
    pendingAction: 'restoreStatus',
    targetType: 'checklist',
    targetId: 44,
    targetName: 'ERP Validation Work',
    previousStatus: 'Completed',
  });

  try {
    const envelope = await orchestrator.run({
      message: 'Pending',
      user: { user_id: 5, role: 'Employee', name: 'Test User' },
      sessionId: null,
    });

    assert.deepEqual(envelope.toolsInvoked, ['updateChecklistStatus']);
    assert.equal(envelope.intent, 'restoreStatus');
    assert.equal(envelope.text, [
      'Checklist "ERP Validation Work" status changed successfully.',
      '',
      'Previous Status: Completed',
      'Current Status: Pending',
    ].join('\n'));
    const updateQuery = queries.find((query) => /UPDATE checklist/i.test(query.sql));
    assert.ok(updateQuery);
    assert.deepEqual(updateQuery.params.slice(0, 3), ['Pending', null, 44]);
    assert.equal(session.slots.pendingAction, null);
  } finally {
    restoreMirror();
    session.restore();
    restoreProvider();
    db.query = originalQuery;
  }
});

test('orchestrator: checklist status update is not routed to task status', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      {
        content: null,
        toolCalls: [{ id: 'status_1', name: 'updateTaskStatus', args: { status: 'Completed' } }],
        usage: {},
      },
      { content: 'unused', toolCalls: [], usage: {} },
    ],
  });

  const db = require('../../../config/db.config');
  const originalQuery = db.query;
  const restoreMirror = patchLegacyMirror();
  const queries = [];
  db.query = async (sql, params) => {
    queries.push({ sql, params });
    if (/SELECT id, question, status/i.test(sql)) {
      return {
        rows: [
          { id: 44, question: 'Test Login Functionality', status: 'Pending' },
        ],
      };
    }
    if (/UPDATE checklist/i.test(sql)) {
      return {
        rows: [
          { id: 44, question: 'Test Login Functionality', status: 'Completed' },
        ],
      };
    }
    return { rows: [] };
  };

  const restoreProvider = patchProvider(provider);
  const session = patchSessionStore();
  let taskStatusCalled = false;
  const restoreTaskStatus = patchRegistry('updateTaskStatus', async () => {
    taskStatusCalled = true;
    return { ok: true };
  });

  try {
    const envelope = await orchestrator.run({
      message: 'Test Login Functionality this is my checklist can you change the status into complete',
      user: { user_id: 5, role: 'Employee', name: 'Test User' },
      sessionId: null,
    });

    assert.equal(taskStatusCalled, false);
    assert.deepEqual(envelope.toolsInvoked, ['updateChecklistStatus']);
    assert.equal(envelope.text, [
      'Checklist "Test Login Functionality" status changed successfully.',
      '',
      'Previous Status: Pending',
      'Current Status: Completed',
    ].join('\n'));
    const updateQuery = queries.find((query) => /UPDATE checklist/i.test(query.sql));
    assert.ok(updateQuery);
    assert.equal(updateQuery.params[0], 'Completed');
    assert.ok(updateQuery.params[1] instanceof Date);
    assert.equal(updateQuery.params[2], 44);
  } finally {
    restoreTaskStatus();
    restoreMirror();
    session.restore();
    restoreProvider();
    db.query = originalQuery;
  }
});

test('orchestrator: task priority update is not routed to task listing', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      {
        content: null,
        toolCalls: [{ id: 'list_1', name: 'getMyTasks', args: { priority: 'High' } }],
        usage: {},
      },
      { content: 'unused', toolCalls: [], usage: {} },
    ],
  });

  const restoreProvider = patchProvider(provider);
  const session = patchSessionStore();
  const restoreMirror = patchLegacyMirror();
  let taskPriorityArgs;
  let getMyTasksCalled = false;
  const restorePriority = patchRegistry('updateTaskPriority', async (args) => {
    taskPriorityArgs = args;
    return {
      ok: true,
      summary: {
        title: 'task',
        previousPriority: 'Low',
        priority: 'High',
      },
    };
  });
  const restoreGetMyTasks = patchRegistry('getMyTasks', async () => {
    getMyTasksCalled = true;
    return { ok: true, tasks: [] };
  });

  try {
    const envelope = await orchestrator.run({
      message: 'can you change the priority for my task task tile is task priority into hight',
      user: { user_id: 5, role: 'Employee', name: 'Test User' },
      sessionId: null,
    });

    assert.equal(getMyTasksCalled, false);
    assert.deepEqual(envelope.toolsInvoked, ['updateTaskPriority']);
    assert.deepEqual(taskPriorityArgs, { priority: 'High', taskTitle: 'task' });
    assert.equal(envelope.text, [
      'Task "task" priority changed successfully.',
      '',
      'Previous Priority: Low',
      'Current Priority: High',
    ].join('\n'));
  } finally {
    restoreGetMyTasks();
    restorePriority();
    restoreMirror();
    session.restore();
    restoreProvider();
  }
});

test('orchestrator: things-to-complete prompt creates checklist only', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      {
        content: null,
        toolCalls: [
          { id: 'task_1', name: 'createTask', args: { title: 'Finish ERP testing before client review', assignedTo: 'Adarsh', dueDate: 'tomorrow morning', priority: 'High' } },
          { id: 'checklist_1', name: 'createChecklist', args: {} },
        ],
        usage: {},
      },
      { content: 'unused', toolCalls: [], usage: {} },
    ],
  });

  let checklistArgs;
  let taskCalled = false;
  const restoreProvider = patchProvider(provider);
  const session = patchSessionStore();
  const restoreChecklist = patchRegistry('createChecklist', async (args, user) => {
    checklistArgs = args;
    return {
      ok: true,
      summary: {
        question: args.question,
        assignee: 'Adarsh Shrivastava',
        doer: user.name,
        priority: args.priority,
        dueDateFormatted: args.dueDate,
        status: 'Pending',
        checklistItems: args.checklistItems || [],
      },
    };
  });
  const restoreTask = patchRegistry('createTask', async () => {
    taskCalled = true;
    return { ok: true };
  });
  const restoreMirror = patchLegacyMirror();

  try {
    const envelope = await orchestrator.run({
      message: 'During today\'s meeting, Aashu mentioned that ERP testing is still pending before the client review. I told Adarsh to finish everything by tomorrow morning because we cannot delay the release. Keep Bhumika in the loop and make it high priority. Things to complete: - Verify attendance module - Test task creation - Check pending tasks - Validate dashboard data - Review reports',
      user: { user_id: 5, role: 'Employee', name: 'Test User' },
      sessionId: null,
    });

    assert.equal(taskCalled, false);
    assert.deepEqual(envelope.toolsInvoked, ['createChecklist']);
    assert.equal(checklistArgs.question, 'Erp Testing');
    assert.equal(checklistArgs.assignee, 'Adarsh');
    assert.equal(checklistArgs.doer, undefined);
    assert.equal(checklistArgs.inLoopUsers, undefined);
    assert.equal(checklistArgs.priority, 'High');
    assert.equal(checklistArgs.dueDate, 'tomorrow morning');
    assert.deepEqual(checklistArgs.checklistItems, [
      'Verify attendance module',
      'Test task creation',
      'Check pending tasks',
      'Validate dashboard data',
      'Review reports',
    ]);
    assert.doesNotMatch(envelope.text, /Task Created/);
    assert.match(envelope.text, /Checklist Created Successfully/);
    assert.doesNotMatch(envelope.text, /In Loop/);
  } finally {
    restoreTask();
    restoreChecklist();
    session.restore();
    restoreProvider();
    restoreMirror();
  }
});

test('orchestrator: reminded task assigns named employee and keeps assignedBy as current user', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      { content: null, toolCalls: [{ id: 'task_1', name: 'createTask', args: {} }], usage: {} },
      { content: 'unused', toolCalls: [], usage: {} },
    ],
  });

  let capturedArgs;
  const restoreProvider = patchProvider(provider);
  const session = patchSessionStore();
  const restoreTool = patchRegistry('createTask', async (args, user) => {
    capturedArgs = args;
    return {
      ok: true,
      summary: {
        title: args.title,
        assignedTo: 'Aashu Yadav',
        assignedBy: user.name,
        dueDate: args.dueDate,
        priority: args.priority || 'Medium',
        status: 'Pending',
      },
    };
  });
  const restoreMirror = patchLegacyMirror();

  try {
    const envelope = await orchestrator.run({
      message: 'I reminded Aashu that before 6 PM today we need to finish ERP validation work',
      user: { user_id: 5, role: 'Employee', name: 'Bhumika Girhare' },
      sessionId: null,
    });

    assert.equal(capturedArgs.assignedTo, 'Aashu');
    assert.equal(capturedArgs.dueDate.toLowerCase(), 'today 6 pm');
    assert.match(capturedArgs.title, /finish ERP validation work/i);
    assert.match(envelope.text, /Assigned To:\*\* Aashu Yadav/);
    assert.match(envelope.text, /Assigned By:\*\* Bhumika Girhare/);
    assert.doesNotMatch(envelope.text, /Assigned By:\*\* Aashu Yadav/);
  } finally {
    restoreTool();
    session.restore();
    restoreProvider();
    restoreMirror();
  }
});

test('orchestrator: checklist creation extracts clean fields and compact response', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      { content: null, toolCalls: [{ id: 'c1', name: 'createChecklist', args: {} }], usage: {} },
      { content: 'unused', toolCalls: [], usage: {} },
    ],
  });

  let capturedArgs;
  const restoreProvider = patchProvider(provider);
  const session = patchSessionStore();
  const restoreTool = patchRegistry('createChecklist', async (args, user) => {
    capturedArgs = args;
    return {
      ok: true,
      summary: {
        question: args.question,
        assignee: 'Adarsh Shrivastava',
        doer: user.name,
        priority: args.priority,
        dueDateFormatted: args.dueDate,
        status: 'Pending',
        checklistItems: args.checklistItems || [],
      },
    };
  });
  const restoreMirror = patchLegacyMirror();

  try {
    const envelope = await orchestrator.run({
      message: [
        'Create checklist: Tomorrow morning I asked Adarsh to complete website testing. Keep Bhumika in the loop',
        '- Check login page',
        '- Verify forgot password',
        '- Test profile update',
      ].join('\n'),
      user: { user_id: 5, role: 'Employee', name: 'Test User' },
      sessionId: null,
    });

    assert.equal(capturedArgs.question, 'Website Testing');
    assert.equal(capturedArgs.assignee, 'Adarsh');
    assert.equal(capturedArgs.doer, undefined);
    assert.deepEqual(capturedArgs.checklistItems, ['Check login page', 'Verify forgot password', 'Test profile update']);
    assert.equal(capturedArgs.inLoopUsers, undefined);
    assert.equal(capturedArgs.dueDate, 'tomorrow morning');
    assert.match(envelope.text, /Checklist Title: Website Testing/);
    assert.match(envelope.text, /Assignee: Adarsh Shrivastava/);
    assert.match(envelope.text, /Doer: Test User/);
    assert.doesNotMatch(envelope.text, /In Loop/);
    assert.match(envelope.text, /□ Check login page/);
    assert.match(envelope.text, /□ Verify forgot password/);
    assert.doesNotMatch(envelope.text, /^Question:/m);
    assert.doesNotMatch(envelope.text, /Frequency: custom/);
  } finally {
    restoreTool();
    session.restore();
    restoreProvider();
    restoreMirror();
  }
});

test('orchestrator: duplicate checklist returns already exists message', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      { content: null, toolCalls: [{ id: 'c1', name: 'createChecklist', args: { question: 'ERP Validation Work' } }], usage: {} },
      { content: 'unused', toolCalls: [], usage: {} },
    ],
  });

  const restoreProvider = patchProvider(provider);
  const session = patchSessionStore();
  const restoreTool = patchRegistry('createChecklist', async () => ({
    ok: true,
    duplicate: true,
    message: 'Checklist already exists. Please make a new checklist.',
    summary: { question: 'ERP Validation Work' },
  }));
  const restoreMirror = patchLegacyMirror();

  try {
    const envelope = await orchestrator.run({
      message: 'Create checklist for ERP validation work',
      user: { user_id: 5, role: 'Employee', name: 'Test User' },
      sessionId: null,
    });

    assert.match(envelope.text, /Checklist already exists: ERP Validation Work/);
    assert.match(envelope.text, /Please make a new checklist/);
    assert.doesNotMatch(envelope.text, /Checklist Created Successfully/);
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
