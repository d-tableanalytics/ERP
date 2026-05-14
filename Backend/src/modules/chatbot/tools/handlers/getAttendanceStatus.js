const attendanceAdapter = require('../../adapters/attendanceAdapter');
const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');

const schema = {
  date: { type: 'string', max: 32 },
  period: { type: 'string', enum: ['today', 'yesterday', 'tomorrow', 'this week', 'last week', 'this month'] },
};

module.exports = async function getAttendanceStatus(args, user) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  const userId = resolveUserId(user);
  const result = await attendanceAdapter.getStatus(userId, v.value);
  return { ok: true, ...result, slot: { lastEntity: 'attendance', lastPeriod: result.period } };
};
