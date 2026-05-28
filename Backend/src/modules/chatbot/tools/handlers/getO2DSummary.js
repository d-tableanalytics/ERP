const o2dService = require('../../../../services/o2d.service');

module.exports = async function getO2DSummary(args, user) {
  const summary = await o2dService.getSummary(user);
  const alerts = await o2dService.getAlerts(user);
  return {
    ...summary,
    alerts: {
      overdue: alerts.overdue.length,
      stuck: alerts.stuck.length,
      approachingDelivery: alerts.approachingDelivery.length,
    },
    slot: { lastEntity: 'o2d' },
  };
};
