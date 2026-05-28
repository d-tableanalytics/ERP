const o2dService = require('../../../../services/o2d.service');
const { validate } = require('../../validators/toolArgs');

const schema = {
  stuckDays: { type: 'integer', min: 1, max: 30 },
  approachingDays: { type: 'integer', min: 1, max: 30 },
};

module.exports = async function getO2DAlerts(args, user) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  const alerts = await o2dService.getAlerts(user, v.value);
  return {
    ...alerts,
    slot: { lastEntity: 'o2d', lastO2DAlert: 'all' },
  };
};
