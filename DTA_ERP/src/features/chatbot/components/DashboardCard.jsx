import React from 'react';

const StatBlock = ({ icon, label, value, tone = 'slate' }) => {
  const toneMap = {
    slate: 'text-slate-700 bg-slate-50',
    red: 'text-red-600 bg-red-50',
    amber: 'text-amber-600 bg-amber-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    blue: 'text-blue-600 bg-blue-50',
  };
  return (
    <div className={`flex flex-col items-center justify-center rounded-lg px-2 py-2 ${toneMap[tone]}`}>
      <span className="material-symbols-outlined text-base">{icon}</span>
      <div className="text-base font-bold leading-tight mt-0.5">{value}</div>
      <div className="text-[9px] uppercase tracking-wide opacity-75">{label}</div>
    </div>
  );
};

const DashboardCard = ({ card }) => {
  if (!card) return null;
  const t = card.tasks || {}; const c = card.checklists || {}; const k = card.tickets || {};
  return (
    <div className="chatbot-card border border-border-main bg-bg-card rounded-xl p-3 mt-2 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-primary text-lg">dashboard</span>
        <div className="text-sm font-semibold text-text-main">{card.title || 'Your Dashboard'}</div>
      </div>
      <div className="space-y-2">
        <div>
          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">Tasks</div>
          <div className="grid grid-cols-4 gap-1.5">
            <StatBlock icon="pending" label="Pending" value={t.pending ?? 0} tone="amber" />
            <StatBlock icon="bolt" label="Active" value={t.inProgress ?? 0} tone="blue" />
            <StatBlock icon="check_circle" label="Done" value={t.completed ?? 0} tone="emerald" />
            <StatBlock icon="warning" label="Overdue" value={t.overdue ?? 0} tone="red" />
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">Checklists</div>
          <div className="grid grid-cols-3 gap-1.5">
            <StatBlock icon="pending" label="Pending" value={c.pending ?? 0} tone="amber" />
            <StatBlock icon="check_circle" label="Done" value={c.completed ?? 0} tone="emerald" />
            <StatBlock icon="warning" label="Overdue" value={c.overdue ?? 0} tone="red" />
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">Tickets</div>
          <div className="grid grid-cols-2 gap-1.5">
            <StatBlock icon="folder_open" label="Open" value={k.open ?? 0} tone="blue" />
            <StatBlock icon="lock" label="Closed" value={k.closed ?? 0} tone="slate" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardCard;
