const cards = require('./cards');
const { ResponseType } = require('../constants/responseTypes');
const { inferIntent } = require('../constants/intents');

/**
 * Final envelope used by the frontend.
 * Same shape returned by both the JSON endpoint and the SSE "done" event.
 */

function build({
  text,
  toolCalls = [],
  toolResults = [],
  responseType,
  verbosity,
  sessionId,
  messageId,
  confidence = 0.9,
  suggestions = [],
  quickActions = [],
  error = null,
}) {
  const builtCards = cards.fromToolResults(toolResults);
  const intent = inferIntent(toolCalls);

  return {
    success: !error,
    sessionId,
    messageId,
    intent,
    confidence,
    responseType: responseType || ResponseType.TEXT,
    verbosity: verbosity || 'medium',
    text: text || '',
    cards: builtCards,
    quickActions,
    suggestions,
    toolsInvoked: toolCalls.map((t) => t.name),
    error,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Suggest follow-up prompts based on which tools were used.
 * Keeps the UI feeling alive; user can click instead of typing.
 */
function suggestFollowUps({ toolCalls = [], toolResults = [], slots = {} }) {
  const tools = toolCalls.map((t) => t.name);
  const out = [];

  if (tools.includes('getMyTasks')) {
    out.push('Which one is high priority?');
    out.push('What\'s overdue?');
    if (slots.lastFilters && !slots.lastFilters.status) out.push('Show only pending');
  }
  if (tools.includes('getTaskDetail')) {
    out.push('Who assigned this task?');
    out.push('What\'s the description?');
  }
  if (tools.includes('countTasks')) {
    out.push('Show them as a list');
  }
  if (tools.includes('getMyChecklists')) {
    out.push('Show overdue checklists');
    out.push('Show only daily ones');
  }
  if (tools.includes('getDashboardSummary')) {
    out.push('Show my pending tasks');
    out.push('Anything overdue?');
  }
  if (tools.includes('getAttendanceStatus')) {
    out.push('Show this week\'s attendance');
  }
  if (tools.includes('getHelpGuidance')) {
    out.push('Show me an example');
  }

  // Generic fallbacks
  if (out.length === 0) {
    out.push('Show my pending tasks');
    out.push('What\'s overdue?');
    out.push('Show my dashboard');
  }
  return out.slice(0, 4);
}

function suggestQuickActions({ toolCalls = [], toolResults = [] }) {
  const actions = [];
  const tools = toolCalls.map((t) => t.name);

  if (tools.includes('getMyTasks')) {
    actions.push({ label: 'High priority only', prompt: 'show only my high priority tasks' });
    actions.push({ label: 'Overdue', prompt: 'what tasks are overdue' });
  }
  if (tools.includes('getMyChecklists')) {
    actions.push({ label: 'Today only', prompt: 'checklists due today' });
  }
  return actions.slice(0, 3);
}

module.exports = { build, suggestFollowUps, suggestQuickActions };
