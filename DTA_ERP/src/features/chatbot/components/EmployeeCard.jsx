import React from 'react';

const EmployeeCard = ({ card }) => {
  if (!card) return null;
  const initials = (card.title || '')
    .split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('');
  return (
    <div className="chatbot-card border border-border-main bg-bg-card rounded-xl p-3 mt-2 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
          {initials || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-text-main">{card.title}</div>
          <div className="text-[10px] text-text-muted truncate">{card.designation || card.role} · {card.department || '—'}</div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeCard;
