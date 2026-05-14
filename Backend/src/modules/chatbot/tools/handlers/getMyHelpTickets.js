const helpdeskAdapter = require('../../adapters/helpdeskAdapter');
const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');

const schema = {
  status: { type: 'string', max: 32 },
  limit: { type: 'integer', min: 1, max: 25 },
};

module.exports = async function getMyHelpTickets(args, user) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  const userId = resolveUserId(user);
  const tickets = await helpdeskAdapter.getMyTickets(userId, v.value);
  return {
    ok: true,
    count: tickets.length,
    tickets,
    slot: { lastEntity: 'help_ticket', lastFilters: v.value, lastResultIds: tickets.map((t) => t.id) },
  };
};
