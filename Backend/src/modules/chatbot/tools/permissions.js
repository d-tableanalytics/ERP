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
  getChatSummary: 'any',
  getO2DOrders: 'any',
  getO2DOrderByPO: 'any',
  getO2DOrdersByStep: 'any',
  getO2DOverdueOrders: 'any',
  getO2DSummary: 'any',
  getO2DAlerts: 'any',
  updateO2DStep: 'any',
  correctO2DStep: 'any',
  addO2DRemark: 'any',
  getO2DStepHistory: 'any',
  listEmployees: 'admin',
  searchEmployees: 'admin',
  getTeamWorkload: 'admin',
  getTeamCompletionAccuracy: 'admin',
  getHelpGuidance: 'any',
  createTask: 'any',
  createChecklist: 'any',
  updateTaskStatus: 'any',
  updateTaskPriority: 'any',
  updateChecklistStatus: 'any',
  updateTaskDueDate: 'any',
  updateTaskTitle: 'any',
  updateTaskLoopUsers: 'any',
  updateTaskAssignment: 'any',
  deleteTask: 'any',
  deleteChecklist: 'any',
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
