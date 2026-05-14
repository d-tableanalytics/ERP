/**
 * Abstract LLM provider interface. Concrete providers (OpenAIProvider, etc.)
 * implement these methods so the orchestrator can swap providers via env.
 */

class BaseProvider {
  // eslint-disable-next-line no-unused-vars
  async chat({ messages, tools, toolChoice, temperature, maxTokens }) {
    throw new Error('chat() not implemented');
  }

  // eslint-disable-next-line no-unused-vars
  async *stream({ messages, tools, toolChoice, temperature, maxTokens }) {
    throw new Error('stream() not implemented');
  }

  isAvailable() { return false; }
  get name() { return 'base'; }
}

module.exports = BaseProvider;
