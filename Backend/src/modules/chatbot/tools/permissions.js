/**
 * Permission map (defense-in-depth). Even if a tool name leaks past prompt filtering,
 * the registry checks here before dispatching.
 */

const TOOL_ROLES = Object.freeze({
  getMyTasks: 'any',
  getTaskDetail: 'any',
  countTasks: 'any',
  getMyChecklists: 'any',
  getChecklistDetail: 'any',
  getOverdueItems: 'any',
  getAttendanceStatus: 'any',
  getMyHelpTickets: 'any',
  getDashboardSummary: 'any',
  searchEmployees: 'admin',
  getTeamWorkload: 'admin',
  getHelpGuidance: 'any',
});

function canCallTool(toolName, user) {
  const required = TOOL_ROLES[toolName];
  if (!required) return false;
  if (required === 'any') return true;
  if (required === 'admin') {
    return user && (user.role === 'Admin' || user.role === 'SuperAdmin');
  }
  return false;
}

module.exports = { TOOL_ROLES, canCallTool };
