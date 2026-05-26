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

test('orchestrator: casual English and Hindi greetings are answered warmly without provider refusal', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      { content: 'provider should not be used', toolCalls: [], usage: {} },
    ],
  });
  const restoreProvider = patchProvider(provider);
  const restoreMirror = patchLegacyMirror();
  const session = patchSessionStore();

  try {
    const english = await orchestrator.run({
      message: 'hello how are you',
      user: { user_id: 5, role: 'Employee', name: 'Test User' },
      sessionId: null,
    });
    assert.match(english.text, /I'm good/);
    assert.match(english.text, /tasks, checklists, attendance, or dashboard/i);
    assert.doesNotMatch(english.text, /can only assist/i);

    const hindi = await orchestrator.run({
      message: 'kya hal hai baji Shashi Lal',
      user: { user_id: 5, role: 'Employee', name: 'Test User' },
      sessionId: null,
    });
    assert.match(hindi.text, /Main theek hoon/);
    assert.match(hindi.text, /Shashi Lal ke related task/i);
    assert.doesNotMatch(hindi.text, /can only assist/i);

    const evening = await orchestrator.run({
      message: 'good evening',
      user: { user_id: 5, role: 'Employee', name: 'Test User' },
      sessionId: null,
    });
    assert.match(evening.text, /^Good evening 👋 I'm good 😊/);
  } finally {
    session.restore();
    restoreProvider();
    restoreMirror();
  }
});

test('orchestrator: incomplete checklist creation asks follow-up and does not call tool', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      { content: null, toolCalls: [{ id: 'c1', name: 'createChecklist', args: {} }], usage: {} },
      { content: 'unused', toolCalls: [], usage: {} },
    ],
  });
  let createCalled = false;
  const restoreProvider = patchProvider(provider);
  const restoreMirror = patchLegacyMirror();
  const session = patchSessionStore();
  const restoreTool = patchRegistry('createChecklist', async () => {
    createCalled = true;
    return { ok: false, error: 'question is required' };
  });

  try {
    const envelope = await orchestrator.run({
      message: 'can you create a checklist',
      user: { user_id: 5, role: 'Employee', name: 'Test User' },
      sessionId: null,
    });

    assert.equal(createCalled, false);
    assert.deepEqual(envelope.toolsInvoked, []);
    assert.match(envelope.text, /Please share checklist details/i);
    assert.match(envelope.text, /Checklist title/i);
    assert.match(envelope.text, /Example:/i);
    assert.doesNotMatch(envelope.text, /question is required/i);
  } finally {
    restoreTool();
    session.restore();
    restoreProvider();
    restoreMirror();
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

test('orchestrator: task status transition uses destination status', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      {
        content: null,
        toolCalls: [{ id: 'status_1', name: 'updateTaskStatus', args: { status: 'Pending' } }],
        usage: {},
      },
      { content: 'unused', toolCalls: [], usage: {} },
    ],
  });

  const restoreProvider = patchProvider(provider);
  const session = patchSessionStore();
  const restoreMirror = patchLegacyMirror();
  let statusArgs;
  const restoreTaskStatus = patchRegistry('updateTaskStatus', async (args) => {
    statusArgs = args;
    return { ok: true, titles: ['onto'], newStatus: args.status };
  });

  try {
    const envelope = await orchestrator.run({
      message: 'can you change the status is pending to complete',
      user: { user_id: 5, role: 'Employee', name: 'Test User' },
      sessionId: null,
    });

    assert.deepEqual(statusArgs, { status: 'Completed' });
    assert.deepEqual(envelope.toolsInvoked, ['updateTaskStatus']);
    assert.equal(envelope.text, [
      'Task Status Updated',
      '**Task Title:** onto',
      '**New Status:** Completed',
    ].join('\n'));
  } finally {
    restoreTaskStatus();
    restoreMirror();
    session.restore();
    restoreProvider();
  }
});

test('orchestrator: combined task field update keeps short exact title', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      {
        content: null,
        toolCalls: [{ id: 'bad_1', name: 'updateTaskPriority', args: { taskTitle: 'debug now i want to', priority: 'High' } }],
        usage: {},
      },
      { content: 'unused', toolCalls: [], usage: {} },
    ],
  });

  const restoreProvider = patchProvider(provider);
  const session = patchSessionStore();
  const restoreMirror = patchLegacyMirror();
  const calls = [];
  const restoreDueDate = patchRegistry('updateTaskDueDate', async (args) => {
    calls.push({ name: 'updateTaskDueDate', args });
    return {
      ok: true,
      summary: {
        title: 'debug',
        dueDate: '03/07/2026',
        assignedTo: 'Aashu',
        assignedBy: 'Bhumika Girhare',
        priority: 'Low',
        status: 'Pending',
      },
    };
  });
  const restoreStatus = patchRegistry('updateTaskStatus', async (args) => {
    calls.push({ name: 'updateTaskStatus', args });
    return { ok: true, titles: ['debug'], newStatus: args.status };
  });
  const restorePriority = patchRegistry('updateTaskPriority', async (args) => {
    calls.push({ name: 'updateTaskPriority', args });
    return { ok: true, summary: { title: 'debug', priority: args.priority, status: 'Completed' } };
  });
  const restoreLoopUsers = patchRegistry('updateTaskLoopUsers', async (args) => {
    calls.push({ name: 'updateTaskLoopUsers', args });
    return { ok: true, summary: { title: 'debug', assignedTo: 'Aashu', inLoop: 'Aashu' } };
  });

  try {
    const envelope = await orchestrator.run({
      message: 'can you some feild in the task title is debug now i want to update due date priority status so duw date is 3/7/2026 priority is high status is complete in loop have aashu',
      user: { user_id: 5, role: 'Employee', name: 'Bhumika Girhare' },
      sessionId: null,
    });

    assert.deepEqual(calls.map((call) => call.name), ['updateTaskDueDate', 'updateTaskStatus', 'updateTaskPriority', 'updateTaskLoopUsers']);
    assert.deepEqual(calls.map((call) => call.args.taskTitle), ['debug', 'debug', 'debug', 'debug']);
    assert.equal(calls[0].args.dueDate, '3/7/2026');
    assert.equal(calls[1].args.status, 'Completed');
    assert.equal(calls[2].args.priority, 'High');
    assert.deepEqual(calls[3].args.loopUsers, ['aashu']);
    assert.match(envelope.text, /\*\*New Task Title:\*\* debug/);
    assert.match(envelope.text, /\*\*Priority:\*\* High/);
    assert.match(envelope.text, /\*\*In Loop:\*\* Aashu/);
  } finally {
    restoreLoopUsers();
    restorePriority();
    restoreStatus();
    restoreDueDate();
    restoreMirror();
    session.restore();
    restoreProvider();
  }
});

test('orchestrator: combined status and priority update keeps task details in response', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      {
        content: null,
        toolCalls: [
          { id: 'status_1', name: 'updateTaskStatus', args: { status: 'Pending' } },
          { id: 'priority_1', name: 'updateTaskPriority', args: { priority: 'Low' } },
        ],
        usage: {},
      },
      { content: 'unused', toolCalls: [], usage: {} },
    ],
  });

  const restoreProvider = patchProvider(provider);
  const session = patchSessionStore();
  session.slots.lastCreatedTaskId = 99;
  session.slots.lastCreatedTaskTitle = 'newto';
  const restoreMirror = patchLegacyMirror();
  const restoreStatus = patchRegistry('updateTaskStatus', async (args) => ({
    ok: true,
    titles: ['newto'],
    newStatus: args.status,
    summary: {
      title: 'newto',
      dueDate: '08/07/2026',
      assignedTo: 'Bhumika Girhare',
      assignedBy: 'Bhumika Girhare',
      priority: 'High',
      status: args.status,
    },
  }));
  const restorePriority = patchRegistry('updateTaskPriority', async (args) => ({
    ok: true,
    summary: {
      title: 'newto',
      dueDate: '08/07/2026',
      assignedTo: 'Bhumika Girhare',
      assignedBy: 'Bhumika Girhare',
      priority: args.priority,
      status: 'Pending',
    },
  }));

  try {
    const envelope = await orchestrator.run({
      message: 'status change complete to pending and aslo priority is high to low',
      user: { user_id: 5, role: 'Employee', name: 'Bhumika Girhare' },
      sessionId: null,
    });

    assert.deepEqual(envelope.toolsInvoked, ['updateTaskStatus', 'updateTaskPriority']);
    assert.equal(envelope.text, [
      'Task Updated',
      '**Old Task Title:** newto',
      '**New Task Title:** newto',
      '**New Due Date:** 08/07/2026',
      '**New Status:** Pending',
      '**Assigned To:** Bhumika Girhare',
      '**Assigned By:** Bhumika Girhare',
      '**Priority:** Low',
    ].join('\n'));
    assert.doesNotMatch(envelope.text, /Not Available/);
    assert.doesNotMatch(envelope.text, /In Loop/);
  } finally {
    restorePriority();
    restoreStatus();
    restoreMirror();
    session.restore();
    restoreProvider();
  }
});

test('orchestrator: task titled phrasing updates title due date priority and status', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      {
        content: null,
        toolCalls: [{ id: 'bad_1', name: 'updateTaskStatus', args: { status: 'In Progress' } }],
        usage: {},
      },
      { content: 'unused', toolCalls: [], usage: {} },
    ],
  });

  const restoreProvider = patchProvider(provider);
  const session = patchSessionStore();
  const restoreMirror = patchLegacyMirror();
  const calls = [];
  const commonSummary = {
    title: 'ERP Final Testing and Bug Fixing',
    dueDate: '30/05/2026',
    assignedTo: 'Adarsh Shrivastava',
    assignedBy: 'Bhumika Girhare',
    priority: 'High',
    status: 'In Progress',
  };
  const restoreDueDate = patchRegistry('updateTaskDueDate', async (args) => {
    calls.push({ name: 'updateTaskDueDate', args });
    return { ok: true, summary: { ...commonSummary, title: 'Finish ERP testing before client review' } };
  });
  const restoreStatus = patchRegistry('updateTaskStatus', async (args) => {
    calls.push({ name: 'updateTaskStatus', args });
    return { ok: true, titles: ['Finish ERP testing before client review'], newStatus: args.status, summary: { ...commonSummary, status: args.status } };
  });
  const restorePriority = patchRegistry('updateTaskPriority', async (args) => {
    calls.push({ name: 'updateTaskPriority', args });
    return { ok: true, summary: { ...commonSummary, priority: args.priority } };
  });
  const restoreTitle = patchRegistry('updateTaskTitle', async (args) => {
    calls.push({ name: 'updateTaskTitle', args });
    return { ok: true, summary: { ...commonSummary, oldTitle: 'Finish ERP testing before client review', title: args.newTitle } };
  });

  try {
    const envelope = await orchestrator.run({
      message: 'Update the task titled "Finish ERP testing before client review". Change the title to "ERP Final Testing and Bug Fixing". Set the due date to 30 May 2026. Set the priority to High. Set the status to In Progress. After updating, show me the updated task details with: - Task Title - Assigned To - Due Date - Priority - Status - Assigned By',
      user: { user_id: 5, role: 'Employee', name: 'Bhumika Girhare' },
      sessionId: null,
    });

    assert.deepEqual(calls.map((call) => call.name), ['updateTaskDueDate', 'updateTaskStatus', 'updateTaskPriority', 'updateTaskTitle']);
    assert.deepEqual(calls.map((call) => call.args.taskTitle), [
      'Finish ERP testing before client review',
      'Finish ERP testing before client review',
      'Finish ERP testing before client review',
      'Finish ERP testing before client review',
    ]);
    assert.equal(calls[0].args.dueDate, '30 May 2026');
    assert.equal(calls[1].args.status, 'In Progress');
    assert.equal(calls[2].args.priority, 'High');
    assert.equal(calls[3].args.newTitle, 'ERP Final Testing and Bug Fixing');
    assert.match(envelope.text, /\*\*New Task Title:\*\* ERP Final Testing and Bug Fixing/);
    assert.match(envelope.text, /\*\*New Due Date:\*\* 30\/05\/2026/);
    assert.match(envelope.text, /\*\*New Status:\*\* In Progress/);
    assert.match(envelope.text, /\*\*Priority:\*\* High/);
    assert.doesNotMatch(envelope.text, /No recent task found/);
  } finally {
    restoreTitle();
    restorePriority();
    restoreStatus();
    restoreDueDate();
    restoreMirror();
    session.restore();
    restoreProvider();
  }
});

test('orchestrator: assigned by me to employee lists delegated tasks', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      {
        content: null,
        toolCalls: [{ id: 'list_1', name: 'getMyTasks', args: {} }],
        usage: {},
      },
      { content: 'unused', toolCalls: [], usage: {} },
    ],
  });

  const restoreProvider = patchProvider(provider);
  const session = patchSessionStore();
  const restoreMirror = patchLegacyMirror();
  let listArgs;
  const restoreGetMyTasks = patchRegistry('getMyTasks', async (args) => {
    listArgs = args;
    return {
      ok: true,
      count: 1,
      tasks: [{
        id: 7,
        title: 'Verify report',
        status: 'Pending',
        priority: 'High',
        assignedBy: 'Bhumika Girhare',
        assignedTo: 'Adarsh Shrivastava',
        dueDateFormatted: '09/07/2026',
      }],
      slot: { lastFilters: args, lastResultIds: [7] },
    };
  });

  try {
    const envelope = await orchestrator.run({
      message: 'i want to see all task assign by mee to adarsh me ites means loggin user',
      user: { user_id: 5, role: 'Employee', name: 'Bhumika Girhare' },
      sessionId: null,
    });

    assert.deepEqual(listArgs, { role: 'delegated', assignedTo: 'adarsh' });
    assert.deepEqual(envelope.toolsInvoked, ['getMyTasks']);
    assert.match(envelope.text, /Here are tasks you assigned to adarsh:/);
    assert.match(envelope.text, /Verify report/);
  } finally {
    restoreGetMyTasks();
    restoreMirror();
    session.restore();
    restoreProvider();
  }
});

test('orchestrator: delegated typo by me to employee lists delegated tasks', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      {
        content: null,
        toolCalls: [{ id: 'list_1', name: 'getMyTasks', args: {} }],
        usage: {},
      },
      { content: 'unused', toolCalls: [], usage: {} },
    ],
  });

  const restoreProvider = patchProvider(provider);
  const session = patchSessionStore();
  const restoreMirror = patchLegacyMirror();
  let listArgs;
  const restoreGetMyTasks = patchRegistry('getMyTasks', async (args) => {
    listArgs = args;
    return { ok: true, count: 0, tasks: [], slot: { lastFilters: args, lastResultIds: [] } };
  });

  try {
    await orchestrator.run({
      message: 'show all deletegrated task that are assign by mee to adarsh',
      user: { user_id: 5, role: 'Employee', name: 'Bhumika Girhare' },
      sessionId: null,
    });

    assert.deepEqual(listArgs, { role: 'delegated', assignedTo: 'adarsh' });
  } finally {
    restoreGetMyTasks();
    restoreMirror();
    session.restore();
    restoreProvider();
  }
});

test('orchestrator: delegated task query with too typo filters by assignee', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      {
        content: null,
        toolCalls: [{ id: 'list_1', name: 'getMyTasks', args: {} }],
        usage: {},
      },
      { content: 'unused', toolCalls: [], usage: {} },
    ],
  });

  const restoreProvider = patchProvider(provider);
  const session = patchSessionStore();
  const restoreMirror = patchLegacyMirror();
  let listArgs;
  const restoreGetMyTasks = patchRegistry('getMyTasks', async (args) => {
    listArgs = args;
    return { ok: true, count: 0, tasks: [], slot: { lastFilters: args, lastResultIds: [] } };
  });

  try {
    await orchestrator.run({
      message: 'can you find the all delegated task assign by me too adarsh',
      user: { user_id: 5, role: 'Employee', name: 'Bhumika Girhare' },
      sessionId: null,
    });

    assert.deepEqual(listArgs, { role: 'delegated', assignedTo: 'adarsh' });
  } finally {
    restoreGetMyTasks();
    restoreMirror();
    session.restore();
    restoreProvider();
  }
});

test('orchestrator: delegation summary for employee is scoped to tasks assigned by me', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      {
        content: null,
        toolCalls: [{ id: 'list_1', name: 'getMyTasks', args: {} }],
        usage: {},
      },
      { content: 'unused', toolCalls: [], usage: {} },
    ],
  });

  const restoreProvider = patchProvider(provider);
  const session = patchSessionStore();
  const restoreMirror = patchLegacyMirror();
  let listArgs;
  const restoreGetMyTasks = patchRegistry('getMyTasks', async (args) => {
    listArgs = args;
    return {
      ok: true,
      count: 4,
      tasks: [
        {
          id: 1,
          title: 'Done task',
          status: 'Completed',
          priority: 'High',
          dueDateFormatted: '20/05/2026',
          assignedTo: 'Adarsh Shrivastava',
          assignedBy: 'Bhumika Girhare',
          description: 'Done task',
        },
        {
          id: 2,
          title: 'Pending task',
          status: 'Pending',
          priority: 'Medium',
          dueDate: '2026-06-02T00:00:00.000Z',
          dueDateFormatted: '02/06/2026',
          assignedTo: 'Adarsh Shrivastava',
          assignedBy: 'Bhumika Girhare',
          description: 'Pending task',
        },
        {
          id: 3,
          title: 'Progress task',
          status: 'In Progress',
          priority: 'Low',
          dueDate: '2026-06-03T00:00:00.000Z',
          dueDateFormatted: '03/06/2026',
          assignedTo: 'Adarsh Shrivastava',
          assignedBy: 'Bhumika Girhare',
          description: 'Progress task',
        },
        {
          id: 4,
          title: 'Late task',
          status: 'Pending',
          priority: 'High',
          dueDate: '2026-05-20T00:00:00.000Z',
          dueDateFormatted: '20/05/2026',
          overdue: true,
          assignedTo: 'Adarsh Shrivastava',
          assignedBy: 'Bhumika Girhare',
          description: 'Late task',
        },
      ],
      slot: { lastFilters: args, lastResultIds: [1, 2, 3, 4] },
    };
  });

  try {
    const envelope = await orchestrator.run({
      message: [
        'Show me delegation summary for Adarsh.',
        'I want to track only those tasks that I assigned to Adarsh.',
        'Do not show tasks assigned by other users.',
        'First show a summary, then show task details.',
      ].join(' '),
      user: { user_id: 5, role: 'Employee', name: 'Bhumika Girhare' },
      sessionId: null,
    });

    assert.deepEqual(listArgs, { role: 'delegated', assignedTo: 'Adarsh', summary: true });
    assert.match(envelope.text, /^Delegation Summary: Adarsh/m);
    assert.match(envelope.text, /These are only the tasks assigned by you to Adarsh\./);
    assert.match(envelope.text, /^Summary:/m);
    assert.match(envelope.text, /^Total Tasks: 4/m);
    assert.match(envelope.text, /^Completed: 1/m);
    assert.match(envelope.text, /^Pending: 2/m);
    assert.match(envelope.text, /^In Progress: 1/m);
    assert.match(envelope.text, /^Overdue: 1/m);
    assert.match(envelope.text, /^Upcoming Due: 2/m);
    assert.match(envelope.text, /^Task Details:/m);
    assert.match(envelope.text, /^Completed Tasks:/m);
    assert.match(envelope.text, /^1\. Done task/m);
    assert.match(envelope.text, /   Overdue: No/);
    assert.match(envelope.text, /^Pending Tasks:/m);
    assert.match(envelope.text, /^2\. Late task/m);
    assert.match(envelope.text, /   Overdue: Yes/);
    assert.match(envelope.text, /^In Progress Tasks:/m);
  } finally {
    restoreGetMyTasks();
    restoreMirror();
    session.restore();
    restoreProvider();
  }
});

test('orchestrator: summary of employee tasks assigned by me filters by that employee', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      {
        content: null,
        toolCalls: [{ id: 'list_1', name: 'getMyTasks', args: {} }],
        usage: {},
      },
      { content: 'unused', toolCalls: [], usage: {} },
    ],
  });

  const restoreProvider = patchProvider(provider);
  const session = patchSessionStore();
  const restoreMirror = patchLegacyMirror();
  let listArgs;
  const restoreGetMyTasks = patchRegistry('getMyTasks', async (args) => {
    listArgs = args;
    return {
      ok: true,
      count: 1,
      tasks: [
        {
          id: 12,
          title: 'Test the ERP dashboard',
          status: 'Pending',
          priority: 'High',
          dueDate: '2026-05-28T18:00:00.000Z',
          dueDateFormatted: '28/05/2026 6:00 PM',
          assignedTo: 'Adarsh Shrivastava',
          assignedBy: 'Bhumika Girhare',
        },
      ],
      slot: { lastFilters: args, lastResultIds: [12] },
    };
  });

  try {
    const envelope = await orchestrator.run({
      message: 'summary of adarsh task that are assign by mee',
      user: { user_id: 5, role: 'Employee', name: 'Bhumika Girhare' },
      sessionId: null,
    });

    assert.deepEqual(listArgs, { role: 'delegated', assignedTo: 'adarsh', summary: true });
    assert.match(envelope.text, /^Delegation Summary: adarsh/m);
    assert.match(envelope.text, /These are only the tasks assigned by you to adarsh\./);
    assert.match(envelope.text, /^Total Tasks: 1/m);
    assert.match(envelope.text, /Test the ERP dashboard/);
  } finally {
    restoreGetMyTasks();
    restoreMirror();
    session.restore();
    restoreProvider();
  }
});

test('orchestrator: employee work on time asks for completion accuracy analytics', async () => {
  const provider = mockProvider({
    scriptedResponses: [
      {
        content: 'provider should not be used',
        toolCalls: [],
        usage: {},
      },
    ],
  });

  const restoreProvider = patchProvider(provider);
  const session = patchSessionStore();
  const restoreMirror = patchLegacyMirror();
  let accuracyCalled = false;
  const restoreAccuracy = patchRegistry('getTeamCompletionAccuracy', async (args) => {
    accuracyCalled = true;
    assert.deepEqual(args, {});
    return {
      ok: true,
      count: 2,
      employees: [
        {
          name: 'Adarsh Shrivastava',
          totalAssigned: 4,
          completed: 3,
          onTimeCompleted: 2,
          lateCompleted: 1,
          overduePending: 1,
          completionAccuracy: 66.7,
        },
        {
          name: 'Aashu Yadav',
          totalAssigned: 2,
          completed: 2,
          onTimeCompleted: 2,
          lateCompleted: 0,
          overduePending: 0,
          completionAccuracy: 100,
        },
      ],
    };
  });

  try {
    const envelope = await orchestrator.run({
      message: 'which employe complete the work on time and calculate the accuracy og completions of work',
      user: { user_id: 5, role: 'Admin', name: 'Bhumika Girhare' },
      sessionId: null,
    });

    assert.equal(accuracyCalled, true);
    assert.deepEqual(envelope.toolsInvoked, ['getTeamCompletionAccuracy']);
    assert.match(envelope.text, /^Employee Work Completion Accuracy/m);
    assert.match(envelope.text, /Accuracy = on-time completed tasks \/ completed tasks\./);
    assert.match(envelope.text, /1\. Adarsh Shrivastava/);
    assert.match(envelope.text, /   Completed On Time: 2/);
    assert.match(envelope.text, /   Completion Accuracy: 66.7%/);
    assert.match(envelope.text, /2\. Aashu Yadav/);
    assert.match(envelope.text, /   Completion Accuracy: 100%/);
  } finally {
    restoreAccuracy();
    restoreMirror();
    session.restore();
    restoreProvider();
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
      { content: null, toolCalls: [{ id: 'c1', name: 'createChecklist', args: { question: 'ERP Validation Work', checklistItems: ['Review login'] } }], usage: {} },
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
      message: 'Create checklist for ERP validation work with items: review login',
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
