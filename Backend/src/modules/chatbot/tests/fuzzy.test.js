const test = require('node:test');
const assert = require('node:assert/strict');

const { similarity, bestMatch, levenshtein } = require('../utils/fuzzy');

test('exact match scores 1', () => {
  assert.equal(similarity('hello', 'hello'), 1);
});

test('substring match scores high', () => {
  assert.ok(similarity('redesign', 'Website Redesign — Phase 2') > 0.8);
});

test('typo match scores reasonable', () => {
  assert.ok(similarity('webside redsign', 'Website Redesign') > 0.6);
});

test('bestMatch picks the best candidate', () => {
  const candidates = ['Onboarding Doc', 'Website Redesign', 'Client Approval'];
  const m = bestMatch('redesign', candidates);
  assert.equal(m.item, 'Website Redesign');
});

test('bestMatch returns null when below threshold', () => {
  const m = bestMatch('zzqqxx', ['Apple', 'Banana']);
  assert.equal(m, null);
});

test('levenshtein basic distances', () => {
  assert.equal(levenshtein('kitten', 'sitting'), 3);
  assert.equal(levenshtein('', 'abc'), 3);
});
