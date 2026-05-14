const test = require('node:test');
const assert = require('node:assert/strict');

const { canCallTool } = require('../tools/permissions');
const { isAdmin, resolveUserId, assertRole } = require('../validators/permissions');
const { ChatbotError, ErrorCode } = require('../constants/errors');

test('admin tools blocked for employees', () => {
  const employee = { user_id: 1, role: 'Employee' };
  assert.equal(canCallTool('searchEmployees', employee), false);
  assert.equal(canCallTool('getTeamWorkload', employee), false);
});

test('admin tools allowed for admin', () => {
  const admin = { user_id: 2, role: 'Admin' };
  assert.equal(canCallTool('searchEmployees', admin), true);
  assert.equal(canCallTool('getTeamWorkload', admin), true);
});

test('any-role tools accessible to anyone', () => {
  const employee = { user_id: 1, role: 'Employee' };
  assert.equal(canCallTool('getMyTasks', employee), true);
  assert.equal(canCallTool('getDashboardSummary', employee), true);
});

test('unknown tool denied', () => {
  const admin = { user_id: 2, role: 'Admin' };
  assert.equal(canCallTool('deleteAllData', admin), false);
});

test('isAdmin checks role', () => {
  assert.equal(isAdmin({ role: 'Admin' }), true);
  assert.equal(isAdmin({ role: 'SuperAdmin' }), true);
  assert.equal(isAdmin({ role: 'Employee' }), false);
  assert.equal(isAdmin(null), false);
});

test('resolveUserId handles multiple token shapes', () => {
  assert.equal(resolveUserId({ user_id: 5 }), 5);
  assert.equal(resolveUserId({ id: 7 }), 7);
  assert.equal(resolveUserId({ User_Id: 11 }), 11);
  assert.equal(resolveUserId(null), null);
});

test('assertRole throws ChatbotError for unauthorized', () => {
  assert.throws(() => assertRole({ role: 'Employee' }, 'admin'), ChatbotError);
  assert.doesNotThrow(() => assertRole({ role: 'Admin' }, 'admin'));
  assert.doesNotThrow(() => assertRole({ role: 'Employee' }, 'any'));
});
