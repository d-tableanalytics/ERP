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
  searchEmployees:      require('./handlers/searchEmployees'),
  getTeamWorkload:      require('./handlers/getTeamWorkload'),
  getHelpGuidance:      require('./handlers/getHelpGuidance'),
};

function getHandler(name) {
  return HANDLERS[name] || null;
}

function listToolNames() { return Object.keys(HANDLERS); }

module.exports = { getHandler, listToolNames, HANDLERS };
