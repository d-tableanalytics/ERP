const taskAdapter = require('../../adapters/taskAdapter');
const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');
const { resolveDateRange } = require('../../utils/time');

const schema = {
  status: { type: 'string', enum: ['Pending', 'In Progress', 'Completed', 'Hold'] },
  priority: { type: 'string', enum: ['High', 'Medium', 'Low'] },
  dueBefore: { type: 'date' },
  dueAfter: { type: 'date' },
  period: { type: 'string', enum: ['today', 'tomorrow'] },
  limit: { type: 'integer', min: 1, max: 25 },
};

module.exports = async function getMyTasks(args, user) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  const userId = resolveUserId(user);
  const filters = { ...v.value };
  if (filters.period) {
    const range = resolveDateRange(filters.period);
    if (range) {
      filters.dueAfter = range.from;
      filters.dueBefore = range.to;
    }
  }
  const tasks = await taskAdapter.getMyTasks(userId, filters);
  return { ok: true, count: tasks.length, tasks, slot: { lastEntity: 'task', lastFilters: filters, lastResultIds: tasks.map((t) => t.id) } };
};
