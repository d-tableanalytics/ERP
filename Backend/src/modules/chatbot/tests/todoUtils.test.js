const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveNaturalDate } = require('../tools/handlers/_todoUtils');

test('resolveNaturalDate: parses slash day-month with explicit IST time', () => {
  assert.equal(resolveNaturalDate('29/may 7 pm'), '2026-05-29 19:00:00+05:30');
});

test('resolveNaturalDate: parses spaced day-month with explicit IST time', () => {
  assert.equal(resolveNaturalDate('29 may 7 pm'), '2026-05-29 19:00:00+05:30');
});
