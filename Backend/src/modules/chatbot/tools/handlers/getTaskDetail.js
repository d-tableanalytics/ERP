const taskAdapter = require('../../adapters/taskAdapter');
const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');

const schema = {
  taskId: { type: 'integer', min: 1 },
  taskTitle: { type: 'string', max: 200 },
};

module.exports = async function getTaskDetail(args, user, ctx = {}) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  let { taskId, taskTitle } = v.value;

  // Fallback to session-selected task when neither arg is supplied.
  if (!taskId && !taskTitle && ctx.slots?.selectedTaskId) {
    taskId = ctx.slots.selectedTaskId;
  }
  if (!taskId && !taskTitle) {
    return { ok: false, error: 'Need either taskId or taskTitle (none in slots either).' };
  }

  const userId = resolveUserId(user);
  const task = await taskAdapter.getTaskDetail(userId, { taskId, taskTitle });
  if (!task) return { ok: true, found: false };
  return {
    ok: true,
    found: true,
    task,
    slot: { selectedTaskId: task.id, selectedTaskTitle: task.title, lastEntity: 'task' },
  };
};
