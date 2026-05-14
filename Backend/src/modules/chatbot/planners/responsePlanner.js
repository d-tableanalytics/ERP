const { ResponseType, Verbosity } = require('../constants/responseTypes');

/**
 * Heuristic verbosity + response-type planner. Used to populate the envelope's
 * `verbosity` and `responseType` fields after the LLM has produced its answer.
 * Pure function — no I/O.
 */

const COUNT_PATTERNS = /\b(how many|number of|count of|total (number|count)|how much)\b/i;
const DETAIL_PATTERNS = /\b(detail|details|explain|tell me more|full info|complete info|describe)\b/i;
const LIST_PATTERNS = /\b(list|show( me)?|give me|what are|all of)\b/i;
const GREETING_PATTERNS = /^(hi|hello|hey|good (morning|afternoon|evening)|namaste)\b/i;
const GUIDANCE_PATTERNS = /\b(how (to|do i|can i)|guide me|steps to|process of|what is)\b/i;
const REFUSAL_PATTERNS = /\b(weather|news|stock|salary|password|joke)\b/i;

function plan({ userMessage, toolsInvoked = [], result }) {
  const msg = (userMessage || '').trim();
  if (!msg) return { responseType: ResponseType.TEXT, verbosity: Verbosity.CONCISE };

  if (GREETING_PATTERNS.test(msg) && toolsInvoked.length === 0) {
    return { responseType: ResponseType.GREETING, verbosity: Verbosity.CONCISE };
  }

  const sample = result && typeof result === 'object' ? result : {};
  const usedCount = toolsInvoked.includes('countTasks') || toolsInvoked.includes('getDashboardSummary');
  const usedDetail = toolsInvoked.includes('getTaskDetail') || toolsInvoked.includes('getChecklistDetail');
  const usedList = toolsInvoked.some((t) => ['getMyTasks', 'getMyChecklists', 'getMyHelpTickets', 'getOverdueItems', 'searchEmployees', 'getTeamWorkload'].includes(t));
  const usedGuidance = toolsInvoked.includes('getHelpGuidance');

  if (COUNT_PATTERNS.test(msg) || usedCount) {
    return { responseType: ResponseType.COUNT, verbosity: Verbosity.CONCISE };
  }
  if (DETAIL_PATTERNS.test(msg) || usedDetail) {
    return { responseType: ResponseType.DETAIL, verbosity: Verbosity.DETAILED };
  }
  if (usedList || LIST_PATTERNS.test(msg)) {
    return { responseType: ResponseType.LIST, verbosity: Verbosity.MEDIUM };
  }
  if (GUIDANCE_PATTERNS.test(msg) || usedGuidance) {
    return { responseType: ResponseType.GUIDANCE, verbosity: Verbosity.MEDIUM };
  }
  if (REFUSAL_PATTERNS.test(msg) && toolsInvoked.length === 0) {
    return { responseType: ResponseType.TEXT, verbosity: Verbosity.CONCISE };
  }

  return { responseType: ResponseType.TEXT, verbosity: Verbosity.MEDIUM };
}

module.exports = { plan };
