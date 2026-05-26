const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../../../config/db.config');
const { Task } = require('../../../models/task.model');
const updateTaskDueDate = require('../tools/handlers/updateTaskDueDate');
const updateTaskStatus = require('../tools/handlers/updateTaskStatus');

test('updateTaskDueDate: exact one-word title wins over fuzzy substring match', async () => {
  const originalPoolQuery = db.pool.query;
  const originalUpdate = Task.update;
  const originalFindById = Task.findById;
  const updated = [];

  db.pool.query = async () => ({
    rows: [
      { id: 20, task_title: 'testing debug', due_date: null, priority: 'Medium', status: 'Pending' },
      { id: 10, task_title: 'debug', due_date: null, priority: 'Low', status: 'Pending' },
    ],
  });
  Task.update = async (id, patch) => {
    updated.push({ id, patch });
    return { id, ...patch };
  };
  Task.findById = async (id) => ({
    id,
    taskTitle: id === 10 ? 'debug' : 'testing debug',
    dueDate: '2026-07-03T00:00:00.000Z',
    priority: 'Low',
    status: 'Pending',
  });

  try {
    const result = await updateTaskDueDate(
      { taskTitle: 'debug', dueDate: '3/7/2026' },
      { user_id: 5, name: 'Test User' },
      { slots: {} }
    );

    assert.equal(result.ok, true);
    assert.equal(result.taskId, 10);
    assert.equal(updated[0].id, 10);
    assert.equal(result.summary.title, 'debug');
  } finally {
    db.pool.query = originalPoolQuery;
    Task.update = originalUpdate;
    Task.findById = originalFindById;
  }
});

test('updateTaskStatus: exact one-word title wins over fuzzy substring match', async () => {
  const originalFindAll = Task.findAll;
  const originalFindById = Task.findById;
  const originalUpdate = Task.update;
  const updated = [];

  Task.findAll = async () => [
    { id: 20, taskTitle: 'testing debug', status: 'Pending' },
    { id: 10, taskTitle: 'debug', status: 'Pending' },
  ];
  Task.findById = async (id) => ({
    id,
    taskTitle: id === 10 ? 'debug' : 'testing debug',
    status: 'Pending',
  });
  Task.update = async (id, patch) => {
    updated.push({ id, patch });
    return { id, ...patch };
  };

  try {
    const result = await updateTaskStatus(
      { taskTitle: 'debug', status: 'Completed' },
      { user_id: 5, name: 'Test User' },
      { slots: {} }
    );

    assert.equal(result.ok, true);
    assert.deepEqual(result.titles, ['debug']);
    assert.equal(updated[0].id, 10);
    assert.equal(updated[0].patch.status, 'Completed');
  } finally {
    Task.findAll = originalFindAll;
    Task.findById = originalFindById;
    Task.update = originalUpdate;
  }
});
