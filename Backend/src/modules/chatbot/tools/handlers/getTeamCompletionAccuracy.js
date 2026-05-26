const dashboardAdapter = require('../../adapters/dashboardAdapter');
const { validate } = require('../../validators/toolArgs');
const { assertRole } = require('../../validators/permissions');

const schema = {
  department: { type: 'string', max: 100 },
};

module.exports = async function getTeamCompletionAccuracy(args, user) {
  assertRole(user, 'admin');
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  const rows = await dashboardAdapter.getTeamCompletionAccuracy(v.value);
  return { ok: true, count: rows.length, employees: rows };
};
