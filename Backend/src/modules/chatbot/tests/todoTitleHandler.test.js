const test = require('node:test');
const assert = require('node:assert/strict');

const todoAdapter = require('../adapters/todoAdapter');
const updateTodoTitle = require('../tools/handlers/updateTodoTitle');

test('updateTodoTitle: accepts taskTitle alias as new title with todoId', async () => {
  const originalResolveOne = todoAdapter.resolveOne;
  const originalUpdateField = todoAdapter.updateField;
  let updateArgs;

  todoAdapter.resolveOne = async () => ({
    ok: true,
    todo: { id: 20, title: 'check', createdById: 5, assignedToId: 8 },
  });
  todoAdapter.updateField = async (_user, args) => {
    updateArgs = args;
    return {
      ok: true,
      todo: { id: 20, title: args.value, priority: 'Normal', status: 'To Do' },
    };
  };

  try {
    const result = await updateTodoTitle(
      { todoId: 20, title: 'check', taskTitle: 'check o2d' },
      { user_id: 5, role: 'Employee', name: 'Bhumika Girhare' },
      {}
    );

    assert.equal(result.ok, true);
    assert.equal(updateArgs.value, 'check o2d');
    assert.equal(result.oldTitle, 'check');
    assert.equal(result.newTitle, 'check o2d');
  } finally {
    todoAdapter.resolveOne = originalResolveOne;
    todoAdapter.updateField = originalUpdateField;
  }
});
