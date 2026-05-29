const todoAdapter = require('../../adapters/todoAdapter');
const { requireUser, validateArgs } = require('./_todoUtils');

const schema = {
  limit: { type: 'integer' },
};

module.exports = async function getOverdueTodos(args, user) {
  const auth = requireUser(user);
  if (!auth.ok) return auth;
  const v = validateArgs(args, schema);
  if (!v.ok) return v;
  const todos = await todoAdapter.overdue(user, { limit: v.value.limit });
  return { ok: true, todos };
};
