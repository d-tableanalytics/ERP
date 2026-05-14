const taskAdapter = require('../../adapters/taskAdapter');
const checklistAdapter = require('../../adapters/checklistAdapter');
const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');

const schema = {
  entityType: { type: 'string', enum: ['task', 'checklist', 'all'] },
};

module.exports = async function getOverdueItems(args, user) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  const entityType = v.value.entityType || 'all';
  const userId = resolveUserId(user);
  const result = { ok: true };
  if (entityType === 'task' || entityType === 'all') {
    result.tasks = await taskAdapter.getOverdue(userId);
  }
  if (entityType === 'checklist' || entityType === 'all') {
    result.checklists = await checklistAdapter.getOverdue(userId);
  }
  const ids = [
    ...(result.tasks || []).map((t) => t.id),
    ...(result.checklists || []).map((c) => c.id),
  ];
  result.slot = { lastEntity: entityType === 'all' ? 'task' : entityType, lastResultIds: ids };
  return result;
};
