const todoAdapter = require('../../adapters/todoAdapter');
const logger = require('../../utils/logger');
const { requireUser, validateArgs, selectionResult, normalizeTodoText } = require('./_todoUtils');

const schema = {
  todoId: { type: 'integer' },
  title: { type: 'string', max: 255 },
  taskTitle: { type: 'string', max: 255 },
  task_title: { type: 'string', max: 255 },
  name: { type: 'string', max: 255 },
  oldTitle: { type: 'string', max: 255 },
  currentTitle: { type: 'string', max: 255 },
  existingTitle: { type: 'string', max: 255 },
  newTitle: { type: 'string', max: 255 },
  newTaskTitle: { type: 'string', max: 255 },
  new_task_title: { type: 'string', max: 255 },
  newName: { type: 'string', max: 255 },
};

module.exports = async function updateTodoTitle(args, user, ctx = {}) {
  const auth = requireUser(user);
  if (!auth.ok) return auth;
  const v = validateArgs(args, schema);
  if (!v.ok) return v;

  const value = v.value;
  const todoId = value.todoId;
  const lookupTitle = normalizeTodoText(value.oldTitle || value.currentTitle || value.existingTitle || (!todoId ? value.title || value.taskTitle || value.task_title || value.name : ''));
  const newTitle = normalizeTodoText(value.newTitle || value.newTaskTitle || value.new_task_title || value.newName || (todoId ? value.taskTitle || value.task_title || value.name || value.title : ''));
  const log = logger.child({ requestId: ctx.requestId, sessionId: ctx.sessionId, tool: 'updateTodoTitle' });

  log.info('To-Do title update requested', {
    taskId: todoId,
    oldTitle: lookupTitle || value.oldTitle || null,
    extractedNewTitle: newTitle || null,
    updatePayload: { title: newTitle || null },
  });

  if (!todoId && !lookupTitle) return { ok: false, error: 'Please mention the To-Do task ID or current title.' };
  if (!newTitle) return { ok: false, error: 'Please mention the new To-Do title.' };

  const target = await todoAdapter.resolveOne(user, { todoId, title: lookupTitle });
  if (target.notFound || target.needsSelection || !target.todo) {
    log.warn('To-Do title update target not resolved', { taskId: todoId, oldTitle: lookupTitle, result: target });
    return selectionResult(target) || target;
  }

  const oldTitle = target.todo.title;
  const result = await todoAdapter.updateField(user, { todoId: target.todo.id, title: oldTitle, field: 'title', value: newTitle });
  log.info('To-Do title update database result', {
    taskId: target.todo.id,
    oldTitle,
    extractedNewTitle: newTitle,
    updatePayload: { title: newTitle },
    updatedDatabaseResult: result.todo || result,
  });

  return selectionResult(result) || {
    ...result,
    oldTitle,
    newTitle: result.todo?.title || newTitle,
    slot: result.ok && result.todo ? { lastEntity: 'todo', lastTodoId: result.todo.id, lastTodoTitle: result.todo.title } : undefined,
  };
};
