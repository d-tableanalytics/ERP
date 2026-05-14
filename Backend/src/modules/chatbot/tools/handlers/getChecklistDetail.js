const checklistAdapter = require('../../adapters/checklistAdapter');
const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');

const schema = {
  checklistId: { type: 'integer', min: 1 },
  name: { type: 'string', max: 200 },
};

module.exports = async function getChecklistDetail(args, user, ctx = {}) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  let { checklistId, name } = v.value;
  if (!checklistId && !name && ctx.slots?.selectedChecklistId) {
    checklistId = ctx.slots.selectedChecklistId;
  }
  if (!checklistId && !name) {
    return { ok: false, error: 'Need either checklistId or name.' };
  }
  const userId = resolveUserId(user);
  const checklist = await checklistAdapter.getChecklistDetail(userId, { checklistId, name });
  if (!checklist) return { ok: true, found: false };
  return {
    ok: true,
    found: true,
    checklist,
    slot: { selectedChecklistId: checklist.id, selectedChecklistName: checklist.name, lastEntity: 'checklist' },
  };
};
