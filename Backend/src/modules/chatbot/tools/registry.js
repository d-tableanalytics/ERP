/**
 * Tool name → handler map. Handlers are async functions of (args, user, ctx).
 * Adding a tool? Three steps:
 *   1) Implement handlers/yourTool.js
 *   2) Register it here
 *   3) Add a definition in definitions.js and a permission entry in permissions.js
 */

const HANDLERS = {
  getMyTasks:           require('./handlers/getMyTasks'),
  getTaskDetail:        require('./handlers/getTaskDetail'),
  countTasks:           require('./handlers/countTasks'),
  getMyChecklists:      require('./handlers/getMyChecklists'),
  getChecklistDetail:   require('./handlers/getChecklistDetail'),
  getOverdueItems:      require('./handlers/getOverdueItems'),
  getAttendanceStatus:  require('./handlers/getAttendanceStatus'),
  getMyHelpTickets:     require('./handlers/getMyHelpTickets'),
  getDashboardSummary:  require('./handlers/getDashboardSummary'),
  getChatSummary:       require('./handlers/getChatSummary'),
  getO2DOrders:         require('./handlers/getO2DOrders'),
  getO2DOrderByPO:      require('./handlers/getO2DOrderByPO'),
  getO2DOrdersByStep:   require('./handlers/getO2DOrdersByStep'),
  getO2DOverdueOrders:  require('./handlers/getO2DOverdueOrders'),
  getO2DSummary:        require('./handlers/getO2DSummary'),
  getO2DAlerts:         require('./handlers/getO2DAlerts'),
  updateO2DStep:        require('./handlers/updateO2DStep'),
  correctO2DStep:       require('./handlers/correctO2DStep'),
  addO2DRemark:         require('./handlers/addO2DRemark'),
  getO2DStepHistory:    require('./handlers/getO2DStepHistory'),
  createTodoTask:       require('./handlers/createTodoTask'),
  getTodoTasks:         require('./handlers/getTodoTasks'),
  getTodoTaskByTitle:   require('./handlers/getTodoTaskByTitle'),
  updateTodoStatus:     require('./handlers/updateTodoStatus'),
  updateTodoPriority:   require('./handlers/updateTodoPriority'),
  updateTodoTitle:      require('./handlers/updateTodoTitle'),
  updateTodoDueDate:    require('./handlers/updateTodoDueDate'),
  updateTodoAssignee:   require('./handlers/updateTodoAssignee'),
  deleteTodoTask:       require('./handlers/deleteTodoTask'),
  getTodoSummary:       require('./handlers/getTodoSummary'),
  getOverdueTodos:      require('./handlers/getOverdueTodos'),
  listEmployees:        require('./handlers/listEmployees'),
  searchEmployees:      require('./handlers/searchEmployees'),
  getTeamWorkload:      require('./handlers/getTeamWorkload'),
  getTeamCompletionAccuracy: require('./handlers/getTeamCompletionAccuracy'),
  getHelpGuidance:      require('./handlers/getHelpGuidance'),
  createTask:             require('./handlers/createTask'),
  createChecklist:        require('./handlers/createChecklist'),
  updateTaskStatus:       require('./handlers/updateTaskStatus'),
  updateTaskPriority:     require('./handlers/updateTaskPriority'),
  updateChecklistStatus:  require('./handlers/updateChecklistStatus'),
  updateTaskDueDate:      require('./handlers/updateTaskDueDate'),
  updateTaskTitle:        require('./handlers/updateTaskTitle'),
  updateTaskLoopUsers:    require('./handlers/updateTaskLoopUsers'),
  updateTaskAssignment:   require('./handlers/updateTaskAssignment'),
  deleteTask:             require('./handlers/deleteTask'),
  deleteChecklist:        require('./handlers/deleteChecklist'),
};

function getHandler(name) {
  return HANDLERS[name] || null;
}

function listToolNames() { return Object.keys(HANDLERS); }

module.exports = { getHandler, listToolNames, HANDLERS };
