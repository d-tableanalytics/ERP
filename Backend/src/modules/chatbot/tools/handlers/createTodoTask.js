const todoAdapter = require('../../adapters/todoAdapter');
const {
  requireUser,
  validateArgs,
  resolveNaturalDate,
  formatTodoDate,
  normalizeTodoText,
  isTodoRequiredFieldsQuestion,
  isUnclearTodoCreateTitle,
  TODO_REQUIRED_FIELDS_MESSAGE,
  TODO_TITLE_CLARIFICATION_MESSAGE,
} = require('./_todoUtils');

const schema = {
  title: { type: 'string', required: true, max: 255 },
  description: { type: 'string', max: 1000 },
  priority: { type: 'string', enum: ['Low', 'Normal', 'High', 'Urgent', 'low', 'normal', 'high', 'urgent'] },
  dueDate: { type: 'string', max: 80 },
  assignedTo: { type: 'string', max: 100 },
};

module.exports = async function createTodoTask(args, user) {
  const auth = requireUser(user);
  if (!auth.ok) return auth;
  if (!normalizeTodoText(args?.title)) {
    return { ok: false, message: TODO_TITLE_CLARIFICATION_MESSAGE };
  }
  if (isTodoRequiredFieldsQuestion(args.title)) {
    return { ok: false, message: TODO_REQUIRED_FIELDS_MESSAGE };
  }
  if (isUnclearTodoCreateTitle(args.title)) {
    return { ok: false, message: TODO_TITLE_CLARIFICATION_MESSAGE };
  }
  args = { ...args, title: normalizeTodoText(args.title), description: normalizeTodoText(args.description || args.title) };
  const v = validateArgs(args, schema);
  if (!v.ok) return v;

  const assignee = await todoAdapter.resolveAssignee(v.value.assignedTo, auth.userId);
  const dueDate = resolveNaturalDate(v.value.dueDate);
  const todo = await todoAdapter.create({
    title: v.value.title,
    description: v.value.description || v.value.title,
    priority: todoAdapter.normalizePriority(v.value.priority) || 'Normal',
    dueDate,
    assignedToId: assignee.id,
    createdById: auth.userId,
  });

  return {
    ok: true,
    todo,
    summary: {
      title: todo.title,
      assignedTo: todo.assignedTo || assignee.name || v.value.assignedTo || 'Self',
      priority: todo.priority,
      dueDate: formatTodoDate(todo, v.value.dueDate || 'Not set'),
      status: todo.status,
    },
    slot: { lastEntity: 'todo', lastTodoId: todo.id, lastTodoTitle: todo.title },
  };
};
