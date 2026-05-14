const sessionRepo = require('../repositories/sessionRepository');
const messageRepo = require('../repositories/messageRepository');

/**
 * Postgres-backed session store. The orchestrator uses this for:
 *   - getOrCreate(sessionId, userId) → ensures a thread exists
 *   - loadHistory(sessionId, max)     → recent turns (used to build LLM context)
 *   - mergeSlots(sessionId, patch)    → updates JSONB slot context
 *   - logTurn(...)                    → persists a user/assistant/tool turn
 */

async function getOrCreate(sessionId, userId) {
  return sessionRepo.getOrCreate(sessionId, userId);
}

async function loadHistory(sessionId, max = 12) {
  return messageRepo.listRecent(sessionId, max);
}

async function mergeSlots(sessionId, patch) {
  return sessionRepo.updateContext(sessionId, patch);
}

async function logTurn(row) {
  return messageRepo.insert(row);
}

async function listSessions(userId, limit = 20) {
  return sessionRepo.listForUser(userId, limit);
}

async function clear(sessionId, userId) {
  return sessionRepo.remove(sessionId, userId);
}

async function getSession(sessionId) {
  return sessionRepo.get(sessionId);
}

module.exports = { getOrCreate, loadHistory, mergeSlots, logTurn, listSessions, clear, getSession };
