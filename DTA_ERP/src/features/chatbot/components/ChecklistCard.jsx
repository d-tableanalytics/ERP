import React from 'react';

const statusBadge = (status) => {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'verified') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
  if (s === 'in progress') return 'bg-blue-50 text-blue-600 border-blue-100';
  return 'bg-slate-50 text-slate-600 border-slate-100';
};

const ChecklistCard = ({ card }) => {
  if (!card) return null;
  return (
    <div className="chatbot-card border border-border-main bg-bg-card rounded-xl p-3 mt-2 shadow-sm hover:shadow transition-shadow">
      <div className="flex items-start gap-2">
        <span className="material-symbols-outlined text-primary text-lg mt-0.5">checklist</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-text-main">{card.title}</div>
          {card.doer && <div className="text-[10px] text-text-muted mt-0.5">Doer: {card.doer}</div>}
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
        {card.frequency && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 capitalize">
            {card.frequency}
          </span>
        )}
        {card.dueDateFormatted && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-100">
            Due {card.dueDateFormatted}
          </span>
        )}
      </div>
    </div>
  );
};

export default ChecklistCard;
