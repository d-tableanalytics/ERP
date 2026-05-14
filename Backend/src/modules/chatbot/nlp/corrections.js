/**
 * Lightweight typo / abbreviation map for ERP terms.
 * Applied before sending to the LLM — gives the model a cleaner signal
 * but original text is preserved separately for logging.
 */

const TYPO_MAP = {
  // tasks
  tsk: 'task',
  tasks_: 'tasks',
  tsks: 'tasks',
  taskz: 'tasks',
  // checklists
  chcklst: 'checklist',
  chklst: 'checklist',
  cklst: 'checklist',
  checklst: 'checklist',
  // status
  pendng: 'pending',
  pndng: 'pending',
  compltd: 'completed',
  complted: 'completed',
  cmpltd: 'completed',
  ovrdue: 'overdue',
  // misc
  pls: 'please',
  plz: 'please',
  shw: 'show',
  shwo: 'show',
  hw: 'how',
  thx: 'thanks',
  u: 'you',
  ur: 'your',
  r: 'are',
  // attendance
  attndnce: 'attendance',
  attndnc: 'attendance',
  // tickets
  tckt: 'ticket',
  tkt: 'ticket',
};

function applyCorrections(text) {
  if (!text || typeof text !== 'string') return text;
  // Word-boundary replace, case preserved for first letter where possible
  return text.replace(/\b([A-Za-z]+)\b/g, (match) => {
    const lower = match.toLowerCase();
    const fixed = TYPO_MAP[lower];
    if (!fixed) return match;
    // Preserve simple capitalization
    if (match[0] === match[0].toUpperCase() && match.length > 1) {
      return fixed[0].toUpperCase() + fixed.slice(1);
    }
    return fixed;
  });
}

module.exports = { applyCorrections, TYPO_MAP };
