const taskAdapter = require('../../adapters/taskAdapter');
const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');

const schema = {
  status: { type: 'string', max: 32 },
  role: { type: 'string', enum: ['mine', 'delegated', 'subscribed'] },
};

module.exports = async function countTasks(args, user) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  const userId = resolveUserId(user);
  const count = await taskAdapter.countMyTasks(userId, v.value);
  return { ok: true, count, filters: v.value };
};
