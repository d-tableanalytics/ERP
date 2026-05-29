const todoAdapter = require('../../adapters/todoAdapter');
const { requireUser, validateArgs, resolveNaturalDate, selectionResult } = require('./_todoUtils');

const schema = {
  todoId: { type: 'integer' },
  title: { type: 'string', max: 255 },
  dueDate: { type: 'string', required: true, max: 80 },
};

module.exports = async function updateTodoDueDate(args, user) {
  const auth = requireUser(user);
  if (!auth.ok) return auth;
  const v = validateArgs(args, schema);
  if (!v.ok) return v;
  const dueDate = resolveNaturalDate(v.value.dueDate);
  if (!dueDate) return { ok: false, error: 'I could not understand the due date. Please share it like today, tomorrow, next Monday, or 22 May.' };
  const result = await todoAdapter.updateField(user, { todoId: v.value.todoId, title: v.value.title, field: 'dueDate', value: dueDate });
  return selectionResult(result) || { ...result, newDueDate: dueDate };
};
