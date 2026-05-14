/**
 * Public chatbot module surface.
 * Other code (cron jobs, internal callers) should import from here, not from internals.
 */

const routes = require('./routes/chatbot.routes');
const orchestrator = require('./services/ChatOrchestrator');
const sessionStore = require('./memory/SessionStore');
const kbRepository = require('./repositories/kbRepository');

module.exports = {
  routes,
  orchestrator,
  sessionStore,
  kbRepository,
};
