const todoAdapter = require('../../adapters/todoAdapter');
const { requireUser, validateArgs, selectionResult } = require('./_todoUtils');

const schema = {
  todoId: { type: 'integer' },
  title: { type: 'string', max: 255 },
  assignedTo: { type: 'string', required: true, max: 100 },
};

module.exports = async function updateTodoAssignee(args, user) {
  const auth = requireUser(user);
  if (!auth.ok) return auth;
  const v = validateArgs(args, schema);
  if (!v.ok) return v;
  const assignee = await todoAdapter.resolveAssignee(v.value.assignedTo, auth.userId);
  const result = await todoAdapter.updateField(user, { todoId: v.value.todoId, title: v.value.title, field: 'assignedToId', value: assignee.id });
  return selectionResult(result) || { ...result, assignedTo: assignee.name || v.value.assignedTo };
};
