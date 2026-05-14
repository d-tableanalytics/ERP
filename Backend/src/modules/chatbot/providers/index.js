const OpenAIProvider = require('./OpenAIProvider');

/**
 * Provider factory. Adapter pattern keeps the orchestrator agnostic.
 * Switch via env LLM_PROVIDER=openai (default). Other providers can be added here.
 */

let instance = null;

function getProvider() {
  if (instance) return instance;
  const name = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
  switch (name) {
    case 'openai':
    default:
      instance = new OpenAIProvider();
  }
  return instance;
}

function resetProvider() { instance = null; }

module.exports = { getProvider, resetProvider };
