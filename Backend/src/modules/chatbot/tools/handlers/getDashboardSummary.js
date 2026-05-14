const dashboardAdapter = require('../../adapters/dashboardAdapter');
const { resolveUserId } = require('../../validators/permissions');

module.exports = async function getDashboardSummary(_args, user) {
  const userId = resolveUserId(user);
  const summary = await dashboardAdapter.getSummary(userId);
  return { ok: true, summary };
};
