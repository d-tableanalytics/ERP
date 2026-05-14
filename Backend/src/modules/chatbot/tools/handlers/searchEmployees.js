const employeeAdapter = require('../../adapters/employeeAdapter');
const { validate } = require('../../validators/toolArgs');
const { assertRole } = require('../../validators/permissions');

const schema = {
  nameQuery: { type: 'string', required: true, max: 100 },
  limit: { type: 'integer', min: 1, max: 10 },
};

module.exports = async function searchEmployees(args, user) {
  assertRole(user, 'admin');
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  const employees = await employeeAdapter.search(v.value.nameQuery, { limit: v.value.limit || 5 });
  return { ok: true, count: employees.length, employees };
};
