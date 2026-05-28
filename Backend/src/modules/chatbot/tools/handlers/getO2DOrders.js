const o2dService = require('../../../../services/o2d.service');
const { validate } = require('../../validators/toolArgs');

const schema = {
  poNumber: { type: 'string', max: 100 },
  firm: { type: 'string', max: 255 },
  buyer: { type: 'string', max: 255 },
  item: { type: 'string', max: 255 },
  uid: { type: 'string', max: 100 },
  deliveryDate: { type: 'date' },
  status: { type: 'string', max: 50 },
  currentStep: { type: 'string', max: 255 },
  limit: { type: 'integer', min: 1, max: 50 },
};

module.exports = async function getO2DOrders(args, user) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  const orders = await o2dService.getOrders(v.value, user, { limit: v.value.limit || 20 });
  return {
    ok: true,
    count: orders.length,
    dataSource: 'backend:o2d_orders + o2d_order_items',
    filters: v.value,
    scope: user?.role === 'Admin' || user?.role === 'SuperAdmin' ? 'admin_all_o2d_orders' : 'employee_assigned_o2d_orders',
    orders: orders.map(o2dService.summarizeOrder),
    slot: { lastEntity: 'o2d', lastResultIds: orders.map((order) => order.id) },
  };
};
