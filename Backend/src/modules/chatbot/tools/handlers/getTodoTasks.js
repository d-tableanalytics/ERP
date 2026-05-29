const todoAdapter = require('../../adapters/todoAdapter');
const { requireUser, validateArgs } = require('./_todoUtils');

const schema = {
  status: { type: 'string' },
  priority: { type: 'string' },
  assignedTo: { type: 'string', max: 100 },
  limit: { type: 'integer' },
};

module.exports = async function getTodoTasks(args, user) {
  const auth = requireUser(user);
  if (!auth.ok) return auth;
  const v = validateArgs(args, schema);
  if (!v.ok) return v;

  let assignedToId = null;
  if (v.value.assignedTo) {
    const assignee = await todoAdapter.resolveAssignee(v.value.assignedTo, null);
    assignedToId = assignee.id;
  }

  const todos = await todoAdapter.getVisible(user, { ...v.value, assignedToId });
  return { ok: true, todos, slot: { lastEntity: 'todo', lastTodoResultIds: todos.map((todo) => todo.id) } };
};
