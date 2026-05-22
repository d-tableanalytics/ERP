const test = require('node:test');
const assert = require('node:assert/strict');

const { pool } = require('../../../config/db.config');
const updateTaskPriority = require('../tools/handlers/updateTaskPriority');

test('updateTaskPriority: exact one-word title updates exact task only', async () => {
  const originalQuery = pool.query;
  const queries = [];

  pool.query = async (sql, params) => {
    queries.push({ sql, params });
    if (/FROM tasks/i.test(sql) && /ORDER BY created_at DESC/i.test(sql)) {
      return {
        rows: [
          { id: 1, task_title: 'HELLO TASK', priority: 'Medium', status: 'Pending' },
          { id: 2, task_title: 'task', priority: 'Low', status: 'Pending' },
        ],
      };
    }
    if (/UPDATE tasks SET priority/i.test(sql)) {
      return { rows: [{ id: 2, priority: 'High' }] };
    }
    if (/WHERE t\.id = \$1/i.test(sql)) {
      return {
        rows: [
          { id: 2, taskTitle: 'task', priority: 'High', status: 'Pending' },
        ],
      };
    }
    return { rows: [] };
  };

  try {
    const result = await updateTaskPriority(
      { taskTitle: 'task', priority: 'hight' },
      { user_id: 5, role: 'Employee', name: 'Test User' }
    );

    assert.equal(result.ok, true);
    assert.equal(result.summary.title, 'task');
    assert.equal(result.summary.previousPriority, 'Low');
    assert.equal(result.summary.priority, 'High');
    const updateQuery = queries.find((query) => /UPDATE tasks SET priority/i.test(query.sql));
    assert.ok(updateQuery);
    assert.deepEqual(updateQuery.params, ['High', 2]);
  } finally {
    pool.query = originalQuery;
  }
});

test('updateTaskPriority: one-word title does not weak-match partial task titles', async () => {
  const originalQuery = pool.query;
  const queries = [];

  pool.query = async (sql, params) => {
    queries.push({ sql, params });
    if (/FROM tasks/i.test(sql) && /ORDER BY created_at DESC/i.test(sql)) {
      return {
        rows: [
          { id: 1, task_title: 'HELLO TASK', priority: 'Medium', status: 'Pending' },
        ],
      };
    }
    if (/UPDATE tasks SET priority/i.test(sql)) {
      throw new Error('update should not run for weak one-word match');
    }
    return { rows: [] };
  };

  try {
    const result = await updateTaskPriority(
      { taskTitle: 'task', priority: 'High' },
      { user_id: 5, role: 'Employee', name: 'Test User' }
    );

    assert.equal(result.ok, false);
    assert.equal(result.notFound, true);
    assert.equal(queries.some((query) => /UPDATE tasks SET priority/i.test(query.sql)), false);
  } finally {
    pool.query = originalQuery;
  }
});
