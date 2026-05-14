const test = require('node:test');
const assert = require('node:assert/strict');

const { validate } = require('../validators/toolArgs');

test('valid args coerced and returned', () => {
  const r = validate({ limit: '5', status: 'Pending' }, {
    limit: { type: 'integer', min: 1, max: 25 },
    status: { type: 'string', enum: ['Pending', 'Completed'] },
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.limit, 5);
  assert.equal(r.value.status, 'Pending');
});

test('missing required field errors', () => {
  const r = validate({}, { topic: { type: 'string', required: true } });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /topic.*required/i.test(e)));
});

test('enum violation errors', () => {
  const r = validate({ priority: 'Critical' }, {
    priority: { type: 'string', enum: ['High', 'Medium', 'Low'] },
  });
  assert.equal(r.ok, false);
});

test('number out of range', () => {
  const r = validate({ limit: 100 }, { limit: { type: 'integer', min: 1, max: 25 } });
  assert.equal(r.ok, false);
});

test('optional missing fields are fine', () => {
  const r = validate({}, { name: { type: 'string' } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, {});
});
