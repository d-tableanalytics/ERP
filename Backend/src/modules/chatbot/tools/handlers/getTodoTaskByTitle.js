const todoAdapter = require('../../adapters/todoAdapter');
const { requireUser, validateArgs } = require('./_todoUtils');

const schema = {
  title: { type: 'string', required: true, max: 255 },
};

module.exports = async function getTodoTaskByTitle(args, user) {
  const auth = requireUser(user);
  if (!auth.ok) return auth;
  const v = validateArgs(args, schema);
  if (!v.ok) return v;
  const matches = await todoAdapter.findByTitle(user, v.value.title);
  return {
    ok: true,
    found: matches.length > 0,
    needsSelection: matches.length > 1,
    todos: matches,
    todo: matches.length === 1 ? matches[0] : null,
    message: matches.length > 1 ? 'Multiple tasks match this title. Please choose the correct task.' : undefined,
  };
};
