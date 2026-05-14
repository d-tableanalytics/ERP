const test = require('node:test');
const assert = require('node:assert/strict');

const toolExecutor = require('../services/ToolExecutor');
const registry = require('../tools/registry');

const employee = { user_id: 10, role: 'Employee' };
const admin = { user_id: 1, role: 'Admin' };

test('unknown tool returns ok:false', async () => {
  const r = await toolExecutor.execute({ name: 'nope', args: {}, user: employee });
  assert.equal(r.ok, false);
  assert.match(r.error, /not available/i);
});

test('admin tool denied for employee', async () => {
  const r = await toolExecutor.execute({ name: 'searchEmployees', args: { nameQuery: 'x' }, user: employee });
  assert.equal(r.ok, false);
  assert.match(r.error, /permission/i);
});

test('handler exception captured', async () => {
  const originalHandler = registry.HANDLERS.getDashboardSummary;
  registry.HANDLERS.getDashboardSummary = async () => { throw new Error('boom'); };
  try {
    const r = await toolExecutor.execute({ name: 'getDashboardSummary', args: {}, user: admin });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'TOOL_FAILED');
  } finally {
    registry.HANDLERS.getDashboardSummary = originalHandler;
  }
});

test('latencyMs is reported on every call', async () => {
  const originalHandler = registry.HANDLERS.getDashboardSummary;
  registry.HANDLERS.getDashboardSummary = async () => ({ ok: true, summary: {} });
  try {
    const r = await toolExecutor.execute({ name: 'getDashboardSummary', args: {}, user: admin });
    assert.equal(r.ok, true);
    assert.ok(typeof r.latencyMs === 'number');
  } finally {
    registry.HANDLERS.getDashboardSummary = originalHandler;
  }
});
