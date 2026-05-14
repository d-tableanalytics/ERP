const registry = require('../tools/registry');
const { canCallTool } = require('../tools/permissions');
const { ChatbotError, ErrorCode } = require('../constants/errors');
const logger = require('../utils/logger');

/**
 * Executes a single tool call: permission check → handler → timing.
 * Always returns a JSON-serializable object so the LLM can read the result.
 * On error, returns { ok: false, error: ... } — the orchestrator feeds that back
 * so the LLM can apologize / try again rather than crashing the conversation.
 */

async function execute({ name, args, user, ctx, requestId, sessionId }) {
  const start = Date.now();
  const log = logger.child({ requestId, sessionId, tool: name });

  const handler = registry.getHandler(name);
  if (!handler) {
    log.warn('Tool not found');
    return { ok: false, error: `Tool '${name}' is not available.`, latencyMs: Date.now() - start };
  }
  if (!canCallTool(name, user)) {
    log.warn('Permission denied');
    return { ok: false, error: `You don't have permission to use '${name}'.`, latencyMs: Date.now() - start };
  }

  try {
    const result = await handler(args || {}, user, ctx || {});
    const latencyMs = Date.now() - start;
    log.info('Tool ok', { latencyMs, ok: !!result?.ok });
    return { ...result, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    if (err instanceof ChatbotError) {
      log.warn('Tool blocked by validator', { code: err.code, latencyMs });
      return { ok: false, error: err.message, code: err.code, latencyMs };
    }
    log.error('Tool exception', { error: err.message, latencyMs });
    return { ok: false, error: 'Internal error executing tool.', code: ErrorCode.TOOL_FAILED, latencyMs };
  }
}

module.exports = { execute };
