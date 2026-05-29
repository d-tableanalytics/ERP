const todoAdapter = require('../../adapters/todoAdapter');
const { requireUser, validateArgs, selectionResult } = require('./_todoUtils');

const schema = {
  todoId: { type: 'integer' },
  title: { type: 'string', max: 255 },
};

module.exports = async function deleteTodoTask(args, user) {
  const auth = requireUser(user);
  if (!auth.ok) return auth;
  const v = validateArgs(args, schema);
  if (!v.ok) return v;
  const result = await todoAdapter.remove(user, { todoId: v.value.todoId, title: v.value.title });
  return selectionResult(result) || result;
};
