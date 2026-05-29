const { Role } = require('../constants/responseTypes');

const MAX_TOOL_RESULT_CHARS = 3000;

/**
 * Build the OpenAI `messages` array from persisted history rows.
 *
 * Tool turns in our DB are flattened, but OpenAI expects:
 *   assistant message with .tool_calls
 *   followed by one role:"tool" message per tool result, with tool_call_id
 *
 * For history reconstruction we collapse this into a single assistant message
 * with a short summary line, which keeps the token budget tight while still
 * preserving the conversational flow.
 */

function buildMessages({ systemPrompts, historyRows, currentUserText }) {
  const messages = [];
  for (const sp of systemPrompts) messages.push(sp);

  for (const row of historyRows) {
    if (row.role === Role.USER) {
      messages.push({ role: 'user', content: row.content || '' });
    } else if (row.role === Role.ASSISTANT) {
      messages.push({ role: 'assistant', content: row.content || '' });
    } else if (row.role === Role.TOOL) {
      const summary = summarizeToolForHistory(row);
      messages.push({ role: 'assistant', content: summary });
    }
  }

  if (currentUserText != null) {
    messages.push({ role: 'user', content: currentUserText });
  }
  return messages;
}

function summarizeToolForHistory(row) {
  let result = row.tool_result;
  if (typeof result === 'string') {
    try { result = JSON.parse(result); } catch (_) { /* keep as string */ }
  }

  const toolName = row.tool_name || 'unknown';
  const knownSummary = summarizeKnownTool(toolName, result);
  if (knownSummary) return knownSummary;

  let snippet;
  try {
    snippet = typeof result === 'string' ? result : JSON.stringify(result);
  } catch (_) {
    snippet = String(result);
  }

  const cleanSnippet = String(snippet || '')
    .replace(/^\s*\[tool:[^\]]+\]\s*/i, '')
    .replace(/[{}"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const clipped = cleanSnippet.length > MAX_TOOL_RESULT_CHARS
    ? `${cleanSnippet.slice(0, MAX_TOOL_RESULT_CHARS)}...(truncated)`
    : cleanSnippet;
  return `ERP lookup completed with ${toolName}. ${clipped || 'No additional summary available.'}`;
}

function summarizeKnownTool(toolName, result) {
  if (toolName === 'getMyTasks') {
    const count = Array.isArray(result?.tasks) ? result.tasks.length : Number(result?.count || 0);
    const filters = result?.slot?.lastFilters || {};
    const status = filters.status ? ` ${String(filters.status).toLowerCase()}` : '';
    const range = formatDateRange(filters);
    return `ERP task lookup completed. Found ${count} matching${status} tasks${range}.`;
  }
  if (toolName === 'getTodoTasks') {
    const count = Array.isArray(result?.todos) ? result.todos.length : Number(result?.count || 0);
    return `ERP To-Do lookup completed. Found ${count} matching To-Do tasks.`;
  }
  return null;
}

function formatDateRange(filters = {}) {
  const after = formatDate(filters.dueAfter);
  const before = formatDate(filters.dueBefore);
  if (after && before) return ` between ${after} and ${before}`;
  if (after) return ` from ${after}`;
  if (before) return ` up to ${before}`;
  return '';
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return [
    String(date.getUTCDate()).padStart(2, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    date.getUTCFullYear(),
  ].join('/');
}

module.exports = { buildMessages };
