const employeeAdapter = require('../../adapters/employeeAdapter');
const { validate } = require('../../validators/toolArgs');
const { assertRole } = require('../../validators/permissions');

const schema = {
  limit: { type: 'integer', min: 1, max: 200 },
};

module.exports = async function listEmployees(args, user) {
  assertRole(user, 'admin');
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };

  const employees = await employeeAdapter.listAll({ limit: v.value.limit || 50 });
  return {
    ok: true,
    count: employees.length,
    employees,
    slot: { lastEntity: 'employee' },
  };
};
