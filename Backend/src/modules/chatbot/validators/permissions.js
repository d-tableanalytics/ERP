/**
 * RBAC helpers used inside every tool handler.
 * The LLM cannot bypass these — handlers always invoke `assertRole` before doing work.
 */

const { ChatbotError, ErrorCode } = require('../constants/errors');

const ADMIN_ROLES = new Set(['Admin', 'SuperAdmin']);

function isAdmin(user) {
  return !!user && ADMIN_ROLES.has(user.role);
}

function isSelf(user, targetUserId) {
  if (!user || targetUserId == null) return false;
  const uid = user.user_id ?? user.id ?? user.User_Id;
  return Number(uid) === Number(targetUserId);
}

/**
 * Throw if user's role isn't in the allowed list.
 * Allowed values: 'any', 'admin', or any explicit role string.
 */
function assertRole(user, allowed) {
  if (!user) throw new ChatbotError(ErrorCode.PERMISSION, 'Authentication required');
  if (allowed === 'any') return;
  if (allowed === 'admin') {
    if (!isAdmin(user)) throw new ChatbotError(ErrorCode.PERMISSION, 'Admin-only operation');
    return;
  }
  const list = Array.isArray(allowed) ? allowed : [allowed];
  if (!list.includes(user.role)) {
    throw new ChatbotError(ErrorCode.PERMISSION, `Requires one of: ${list.join(', ')}`);
  }
}

/**
 * Normalize the various token shapes (user_id | id | User_Id) into a single id.
 */
function resolveUserId(user) {
  if (!user) return null;
  const raw = user.user_id ?? user.id ?? user.User_Id;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

module.exports = { isAdmin, isSelf, assertRole, resolveUserId, ADMIN_ROLES };
