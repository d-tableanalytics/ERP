import React from 'react';

const TicketCard = ({ card }) => {
  if (!card) return null;
  return (
    <div className="chatbot-card border border-border-main bg-bg-card rounded-xl p-3 mt-2 shadow-sm">
      <div className="flex items-start gap-2">
        <span className="material-symbols-outlined text-primary text-lg mt-0.5">confirmation_number</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-text-main">{card.title}</div>
          {card.issue && (
            <p className="text-[11px] text-text-muted mt-1 line-clamp-2">{card.issue}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {card.status && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-100">
            {card.status}
          </span>
        )}
        {card.priority && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100 capitalize">
            {card.priority}
          </span>
        )}
        {card.stage && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
            Stage {card.stage}
          </span>
        )}
      </div>
    </div>
  );
};

export default TicketCard;
