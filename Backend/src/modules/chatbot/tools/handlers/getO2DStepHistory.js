const o2dService = require('../../../../services/o2d.service');
const { validate } = require('../../validators/toolArgs');

const schema = {
  orderId: { type: 'integer', min: 1 },
  poNumber: { type: 'string', max: 100 },
};

module.exports = async function getO2DStepHistory(args, user, ctx = {}) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  const values = { ...v.value };
  if (!values.orderId && !values.poNumber && ctx.slots?.selectedO2DOrderId) {
    values.orderId = Number(ctx.slots.selectedO2DOrderId);
  }
  if (!values.orderId && !values.poNumber) {
    return { ok: false, error: 'Please mention the PO number or order ID.' };
  }
  const result = await o2dService.getStepHistory(values, user);
  return {
    ...result,
    order: result.order ? o2dService.summarizeOrder(result.order) : null,
    slot: result.order ? {
      lastEntity: 'o2d',
      selectedO2DOrderId: result.order.id,
      selectedO2DPO: result.order.po_number,
    } : { lastEntity: 'o2d' },
  };
};
