const o2dService = require('../../../../services/o2d.service');
const { validate } = require('../../validators/toolArgs');

const schema = {
  step: { type: 'string', required: true, max: 255 },
  limit: { type: 'integer', min: 1, max: 50 },
};

module.exports = async function getO2DOrdersByStep(args, user) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  const result = await o2dService.getOrdersByStep(v.value.step, user, { limit: v.value.limit || 25 });
  if (!result.ok) return result;
  return {
    ok: true,
    step: result.step,
    count: result.count,
    orders: result.orders.map(o2dService.summarizeOrder),
    slot: { lastEntity: 'o2d', lastO2DStep: result.step, lastResultIds: result.orders.map((order) => order.id) },
  };
};
