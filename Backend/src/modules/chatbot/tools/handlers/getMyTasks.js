const taskAdapter = require('../../adapters/taskAdapter');
const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');

const schema = {
  status: { type: 'string', enum: ['Pending', 'In Progress', 'Completed', 'Rejected', 'Hold'] },
  priority: { type: 'string', enum: ['High', 'Medium', 'Low'] },
  dueBefore: { type: 'date' },
  dueAfter: { type: 'date' },
  limit: { type: 'integer', min: 1, max: 25 },
};

module.exports = async function getMyTasks(args, user) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  const userId = resolveUserId(user);
  const tasks = await taskAdapter.getMyTasks(userId, v.value);
  return { ok: true, count: tasks.length, tasks, slot: { lastEntity: 'task', lastFilters: v.value, lastResultIds: tasks.map((t) => t.id) } };
};
