const ResponseType = Object.freeze({
  TEXT: 'text',
  LIST: 'list',
  DETAIL: 'detail',
  COUNT: 'count',
  CLARIFY: 'clarify',
  GUIDANCE: 'guidance',
  GREETING: 'greeting',
  ERROR: 'error',
});

const Verbosity = Object.freeze({
  CONCISE: 'concise',
  MEDIUM: 'medium',
  DETAILED: 'detailed',
});

const Role = Object.freeze({
  USER: 'user',
  ASSISTANT: 'assistant',
  TOOL: 'tool',
  SYSTEM: 'system',
});

module.exports = { ResponseType, Verbosity, Role };
