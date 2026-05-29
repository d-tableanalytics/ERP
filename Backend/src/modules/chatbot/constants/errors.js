class ChatbotError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ChatbotError';
    this.code = code;
    this.details = details;
  }
}

const ErrorCode = Object.freeze({
  VALIDATION: 'VALIDATION_ERROR',
  PERMISSION: 'PERMISSION_DENIED',
  TOOL_FAILED: 'TOOL_FAILED',
  PROVIDER_FAILED: 'PROVIDER_FAILED',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  INJECTION_BLOCKED: 'INJECTION_BLOCKED',
  RATE_LIMITED: 'RATE_LIMITED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  INTERNAL: 'INTERNAL_ERROR',
});

const ERP_SCOPE_MESSAGE = "I'm the D Table Analytics ERP Assistant. I can help with tasks, To-Do, checklists, attendance, help tickets, O2D, and dashboard insights. Please ask me about any ERP activity you want to view or update.";

const FALLBACK_MESSAGES = Object.freeze({
  [ErrorCode.PROVIDER_UNAVAILABLE]:
    "I'm having trouble reaching my reasoning engine right now. Please try again in a moment.",
  [ErrorCode.PROVIDER_FAILED]:
    "Something went wrong while processing your request. Please try rephrasing or try again.",
  [ErrorCode.TOOL_FAILED]:
    "I couldn't fetch that information from the ERP. Please try again - and if it keeps failing, let the admin know.",
  [ErrorCode.PERMISSION]:
    "You don't have access to that information.",
  [ErrorCode.RATE_LIMITED]:
    "You're sending requests very quickly. Please slow down a moment and try again.",
  [ErrorCode.INJECTION_BLOCKED]: ERP_SCOPE_MESSAGE,
  [ErrorCode.INTERNAL]:
    "Something unexpected happened. Please try again.",
});

module.exports = { ChatbotError, ErrorCode, FALLBACK_MESSAGES };
