/**
 * Compatibility shim — the chatbot module entry point still lives here
 * (Backend/Index.js loads this path), but routing now delegates to the v2
 * router at routes/chatbot.routes.js.
 *
 * Legacy files (chatbot.service.js, chatbot.controller.js, chatbot.formatter.js,
 * chatbot.knowledge.js, chatbot.context.js, chatbot.openai.js) are kept in place
 * so their existing tests continue to pass. They are no longer wired into the
 * HTTP layer.
 */

module.exports = require('./routes/chatbot.routes');
