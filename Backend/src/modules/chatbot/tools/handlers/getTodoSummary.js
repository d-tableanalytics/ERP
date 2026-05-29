const todoAdapter = require('../../adapters/todoAdapter');
const { requireUser } = require('./_todoUtils');

module.exports = async function getTodoSummary(args, user) {
  const auth = requireUser(user);
  if (!auth.ok) return auth;
  const summary = await todoAdapter.summary(user);
  return { ok: true, summary };
};
