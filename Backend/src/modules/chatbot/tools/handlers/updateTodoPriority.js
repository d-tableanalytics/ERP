const todoAdapter = require('../../adapters/todoAdapter');
const { requireUser, validateArgs, selectionResult } = require('./_todoUtils');

const schema = {
  todoId: { type: 'integer' },
  title: { type: 'string', max: 255 },
  priority: { type: 'string', required: true },
};

module.exports = async function updateTodoPriority(args, user) {
  const auth = requireUser(user);
  if (!auth.ok) return auth;
  const v = validateArgs(args, schema);
  if (!v.ok) return v;
  const priority = todoAdapter.normalizePriority(v.value.priority);
  if (!priority) return { ok: false, error: 'Please use a valid priority: Low, Normal, High, or Urgent.' };
  const result = await todoAdapter.updateField(user, { todoId: v.value.todoId, title: v.value.title, field: 'priority', value: priority });
  return selectionResult(result) || { ...result, newPriority: priority };
};
