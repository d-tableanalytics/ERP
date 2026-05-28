const o2dService = require('../../../../services/o2d.service');
const { validate } = require('../../validators/toolArgs');

const schema = {
  limit: { type: 'integer', min: 1, max: 50 },
};

module.exports = async function getO2DOverdueOrders(args, user) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  const result = await o2dService.getOverdueOrders(user, { limit: v.value.limit || 25 });
  return {
    ok: true,
    count: result.count,
    orders: result.orders.map(o2dService.summarizeOrder),
    slot: { lastEntity: 'o2d', lastO2DAlert: 'overdue', lastResultIds: result.orders.map((order) => order.id) },
  };
};
