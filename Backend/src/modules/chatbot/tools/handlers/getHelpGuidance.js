const kbRepo = require('../../repositories/kbRepository');
const { validate } = require('../../validators/toolArgs');

const schema = { topic: { type: 'string', required: true, max: 200 } };

module.exports = async function getHelpGuidance(args /* , user */) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  const matches = await kbRepo.search(v.value.topic, { limit: 3 });
  if (matches.length === 0) {
    return { ok: true, found: false };
  }
  // Return the top match plus shorter alternates so the LLM can compose a richer answer.
  return {
    ok: true,
    found: true,
    top: { topic: matches[0].topic, module: matches[0].module, answer: matches[0].answer },
    alternates: matches.slice(1).map((m) => ({ topic: m.topic, module: m.module })),
  };
};
