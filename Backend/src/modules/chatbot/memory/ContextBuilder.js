const { Role } = require('../constants/responseTypes');

const MAX_TOOL_RESULT_CHARS = 3000;

/**
 * Build the OpenAI `messages` array from persisted history rows.
 *
 * Tool turns in our DB are flattened — but OpenAI expects:
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
      // Inline summary so the model retains continuity without re-running.
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
  let snippet;
  try {
    snippet = JSON.stringify(result);
  } catch (_) {
    snippet = String(result);
  }
  if (snippet && snippet.length > MAX_TOOL_RESULT_CHARS) {
    snippet = snippet.slice(0, MAX_TOOL_RESULT_CHARS) + '…(truncated)';
  }
  return `[tool:${row.tool_name || 'unknown'}] ${snippet || ''}`;
}

module.exports = { buildMessages };
