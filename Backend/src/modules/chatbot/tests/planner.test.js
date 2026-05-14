const test = require('node:test');
const assert = require('node:assert/strict');

const { plan } = require('../planners/responsePlanner');

test('count query → concise count', () => {
  const r = plan({ userMessage: 'how many pending tasks do i have', toolsInvoked: ['countTasks'] });
  assert.equal(r.responseType, 'count');
  assert.equal(r.verbosity, 'concise');
});

test('list query → medium list', () => {
  const r = plan({ userMessage: 'show my pending tasks', toolsInvoked: ['getMyTasks'] });
  assert.equal(r.responseType, 'list');
  assert.equal(r.verbosity, 'medium');
});

test('detail query → detailed', () => {
  const r = plan({ userMessage: 'show details', toolsInvoked: ['getTaskDetail'] });
  assert.equal(r.responseType, 'detail');
  assert.equal(r.verbosity, 'detailed');
});

test('greeting → greeting concise', () => {
  const r = plan({ userMessage: 'hello there', toolsInvoked: [] });
  assert.equal(r.responseType, 'greeting');
});

test('guidance query', () => {
  const r = plan({ userMessage: 'how to create a delegation', toolsInvoked: ['getHelpGuidance'] });
  assert.equal(r.responseType, 'guidance');
});
