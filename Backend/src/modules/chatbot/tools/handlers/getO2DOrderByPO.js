const o2dService = require('../../../../services/o2d.service');
const { validate } = require('../../validators/toolArgs');

const schema = {
  poNumber: { type: 'string', required: true, max: 100 },
};

module.exports = async function getO2DOrderByPO(args, user) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  const order = await o2dService.getOrderByPO(v.value.poNumber, user);
  if (!order) return { ok: true, found: false, message: 'No O2D order found for this PO number.' };
  return {
    ok: true,
    found: true,
    order: o2dService.summarizeOrder(order),
    steps: order.steps,
    slot: { lastEntity: 'o2d', selectedO2DOrderId: order.id, selectedO2DPO: order.po_number },
  };
};
