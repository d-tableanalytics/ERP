import React from 'react';

const priorityBadge = (priority) => {
  const p = (priority || '').toLowerCase();
  if (p === 'high') return 'bg-red-50 text-red-600 border-red-100';
  if (p === 'medium') return 'bg-amber-50 text-amber-600 border-amber-100';
  if (p === 'low') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
  return 'bg-slate-50 text-slate-600 border-slate-100';
};

const statusBadge = (status) => {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'verified') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
  if (s === 'in progress') return 'bg-blue-50 text-blue-600 border-blue-100';
  if (s === 'overdue') return 'bg-red-50 text-red-600 border-red-100';
  return 'bg-slate-50 text-slate-600 border-slate-100';
};

const TaskCard = ({ card, detail = false }) => {
  if (!card) return null;
  return (
    <div className="chatbot-card border border-border-main bg-bg-card rounded-xl p-3 mt-2 shadow-sm hover:shadow transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <span className="material-symbols-outlined text-primary text-lg mt-0.5">task_alt</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-text-main truncate">{card.title}</div>
            {card.assignedBy && (
              <div className="text-[10px] text-text-muted mt-0.5">By {card.assignedBy}</div>
            )}
          </div>
        </div>
        {card.overdue && (
          <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Overdue</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2">
        {card.status && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusBadge(card.status)}`}>
            {card.status}
          </span>
        )}
        {card.priority && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${priorityBadge(card.priority)}`}>
            {card.priority}
          </span>
        )}
        {card.dueDateFormatted && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-100">
            Due {card.dueDateFormatted}
          </span>
        )}
      </div>

      {detail && card.description && (
        <p className="text-[11px] text-text-muted mt-2 line-clamp-3">{card.description}</p>
      )}

      {detail && (
        <div className="grid grid-cols-3 gap-2 mt-2 text-[10px] text-text-muted">
          {card.assignedTo && <div><span className="font-semibold">Doer:</span> {card.assignedTo}</div>}
          {typeof card.remarksCount === 'number' && <div><span className="font-semibold">Remarks:</span> {card.remarksCount}</div>}
          {typeof card.subtasksCount === 'number' && <div><span className="font-semibold">Subtasks:</span> {card.subtasksCount}</div>}
        </div>
      )}
    </div>
  );
};

export default TaskCard;
