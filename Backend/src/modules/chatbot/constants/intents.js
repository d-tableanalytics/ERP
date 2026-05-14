/**
 * Intent labels are derived post-hoc from the LLM's tool calls for analytics.
 * They are NOT used to gate behavior — that's what tools do.
 */

const IntentType = Object.freeze({
  TASK_LIST: 'task_list',
  TASK_DETAIL: 'task_detail',
  TASK_COUNT: 'task_count',
  CHECKLIST_LIST: 'checklist_list',
  CHECKLIST_DETAIL: 'checklist_detail',
  OVERDUE: 'overdue_items',
  ATTENDANCE: 'attendance_status',
  HELP_TICKET: 'help_ticket',
  DASHBOARD: 'dashboard_summary',
  EMPLOYEE_SEARCH: 'employee_search',
  TEAM_WORKLOAD: 'team_workload',
  GUIDANCE: 'help_guidance',
  GREETING: 'greeting',
  CLARIFY: 'clarification',
  REFUSAL: 'refusal',
  UNKNOWN: 'unknown',
});

/**
 * Map tool names → intent labels. The first matching tool in a turn wins.
 */
const TOOL_TO_INTENT = {
  getMyTasks: IntentType.TASK_LIST,
  getTaskDetail: IntentType.TASK_DETAIL,
  countTasks: IntentType.TASK_COUNT,
  getMyChecklists: IntentType.CHECKLIST_LIST,
  getChecklistDetail: IntentType.CHECKLIST_DETAIL,
  getOverdueItems: IntentType.OVERDUE,
  getAttendanceStatus: IntentType.ATTENDANCE,
  getMyHelpTickets: IntentType.HELP_TICKET,
  getDashboardSummary: IntentType.DASHBOARD,
  searchEmployees: IntentType.EMPLOYEE_SEARCH,
  getTeamWorkload: IntentType.TEAM_WORKLOAD,
  getHelpGuidance: IntentType.GUIDANCE,
};

function inferIntent(toolCalls = []) {
  for (const call of toolCalls) {
    const intent = TOOL_TO_INTENT[call.name];
    if (intent) return intent;
  }
  return IntentType.UNKNOWN;
}

module.exports = { IntentType, TOOL_TO_INTENT, inferIntent };
