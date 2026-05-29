const todoAdapter = require('../../adapters/todoAdapter');
const { requireUser, validateArgs, selectionResult } = require('./_todoUtils');

const schema = {
  todoId: { type: 'integer' },
  title: { type: 'string', max: 255 },
  status: { type: 'string', required: true },
};

module.exports = async function updateTodoStatus(args, user) {
  const auth = requireUser(user);
  if (!auth.ok) return auth;
  const v = validateArgs(args, schema);
  if (!v.ok) return v;
  const status = todoAdapter.normalizeStatus(v.value.status);
  if (!status) return { ok: false, error: 'Please use a valid status: To Do, In Progress, or Done.' };
  const result = await todoAdapter.updateField(user, { todoId: v.value.todoId, title: v.value.title, field: 'status', value: status });
  return selectionResult(result) || {
    ...result,
    newStatus: status,
    slot: result.ok && result.todo ? { lastEntity: 'todo', lastTodoId: result.todo.id, lastTodoTitle: result.todo.title } : undefined,
  };
};
