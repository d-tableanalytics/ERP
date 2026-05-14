const checklistAdapter = require('../../adapters/checklistAdapter');
const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');

const schema = {
  status: { type: 'string', max: 32 },
  frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'custom'] },
  limit: { type: 'integer', min: 1, max: 25 },
};

module.exports = async function getMyChecklists(args, user) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  const userId = resolveUserId(user);
  const list = await checklistAdapter.getMyChecklists(userId, v.value);
  return {
    ok: true,
    count: list.length,
    checklists: list,
    slot: { lastEntity: 'checklist', lastFilters: v.value, lastResultIds: list.map((c) => c.id) },
  };
};
