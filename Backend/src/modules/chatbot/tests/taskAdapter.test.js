const test = require('node:test');
const assert = require('node:assert/strict');

const { Task } = require('../../../models/task.model');
const taskAdapter = require('../adapters/taskAdapter');

test('taskAdapter: delegated assignedTo filter falls back to doer name when id mismatches', async () => {
  const originalFindDelegatedTasks = Task.findDelegatedTasks;
  Task.findDelegatedTasks = async () => [
    {
      id: 1,
      taskTitle: 'Verify report',
      doerId: 999,
      doerName: 'Adarsh Shrivastava',
      assignerName: 'Bhumika Girhare',
      status: 'Pending',
      priority: 'High',
      dueDate: '2026-07-08T00:00:00.000Z',
    },
  ];

  try {
    const tasks = await taskAdapter.getDelegatedTasks(5, {
      assignedToId: 123,
      assignedTo: 'Adarsh',
    });

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].title, 'Verify report');
    assert.equal(tasks[0].assignedTo, 'Adarsh Shrivastava');
  } finally {
    Task.findDelegatedTasks = originalFindDelegatedTasks;
  }
});

test('taskAdapter: all role count uses UI All Tasks visibility', async () => {
  const originalFindAll = Task.findAll;
  let capturedUserId;
  Task.findAll = async (_filters, userId) => {
    capturedUserId = userId;
    return [
      { id: 1, taskTitle: 'Mine', doerId: 5, status: 'Pending' },
      { id: 2, taskTitle: 'Delegated', assignerId: 5, doerId: 9, status: 'Pending' },
      { id: 3, taskTitle: 'Loop only', doerId: 9, inLoopIds: [5], status: 'Pending' },
    ];
  };

  try {
    const count = await taskAdapter.countMyTasks(5, { role: 'all' });

    assert.equal(capturedUserId, 5);
    assert.equal(count, 3);
  } finally {
    Task.findAll = originalFindAll;
  }
});

test('taskAdapter: subscribed tasks list includes subscribed-only bucket', async () => {
  const originalFindSubscribedTasks = Task.findSubscribedTasks;
  Task.findSubscribedTasks = async () => [
    {
      id: 3,
      taskTitle: 'Loop only',
      doerId: 9,
      doerName: 'Aashu Yadav',
      assignerName: 'Adarsh Shrivastava',
      inLoopIds: [],
      status: 'Pending',
    },
  ];

  try {
    const tasks = await taskAdapter.getSubscribedTasks(5);

    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].title, 'Loop only');
    assert.equal(tasks[0].assignedTo, 'Aashu Yadav');
  } finally {
    Task.findSubscribedTasks = originalFindSubscribedTasks;
  }
});
