const taskAdapter = require('../../adapters/taskAdapter');
const employeeAdapter = require('../../adapters/employeeAdapter');
const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');
const { resolveDateRange } = require('../../utils/time');

const schema = {
  status: { type: 'string', enum: ['Pending', 'In Progress', 'Completed', 'Hold'] },
  priority: { type: 'string', enum: ['High', 'Medium', 'Low'] },
  role: { type: 'string', enum: ['mine', 'delegated', 'subscribed', 'all'] },
  assignedTo: { type: 'string', max: 100 },
  dueBefore: { type: 'date' },
  dueAfter: { type: 'date' },
  period: { type: 'string', enum: ['today', 'tomorrow'] },
  limit: { type: 'integer', min: 1, max: 25 },
  summary: { type: 'boolean' },
};

module.exports = async function getMyTasks(args, user) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  const userId = resolveUserId(user);
  const filters = { ...v.value };
  if (filters.assignedTo) {
    const matches = await employeeAdapter.search(filters.assignedTo, { limit: 1 }).catch(() => []);
    if (matches[0]) {
      filters.assignedToId = matches[0].id;
      filters.assignedTo = matches[0].name;
    }
  }
  if (filters.period) {
    const range = resolveDateRange(filters.period);
    if (range) {
      filters.dueAfter = range.from;
      filters.dueBefore = range.to;
    }
  }
  let tasks;
  if (filters.role === 'delegated') {
    tasks = await taskAdapter.getDelegatedTasks(userId, filters);
  } else if (filters.role === 'subscribed') {
    tasks = await taskAdapter.getSubscribedTasks(userId, filters);
  } else if (filters.role === 'all') {
    tasks = await taskAdapter.getAllInvolvedTasks(userId, filters);
  } else {
    tasks = await taskAdapter.getMyTasks(userId, filters);
  }
  return { ok: true, count: tasks.length, tasks, slot: { lastEntity: 'task', lastFilters: filters, lastResultIds: tasks.map((t) => t.id) } };
};
