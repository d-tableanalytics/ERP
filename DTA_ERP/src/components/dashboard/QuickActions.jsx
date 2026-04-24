import React from "react";

const QuickActions = () => {
  const actions = [
    { icon: "add_task", label: "New Delegation", color: "blue" },
    { icon: "playlist_add_check", label: "Add Checklist", color: "emerald" },
    { icon: "add_shopping_cart", label: "New Order", color: "orange" },
    { icon: "support_agent", label: "Raise Ticket", color: "purple" },
  ];

  const colorClasses = {
    blue: "text-blue-600 bg-blue-500/10 border-blue-500/20",
    emerald: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
    orange: "text-orange-600 bg-orange-500/10 border-orange-500/20",
    purple: "text-purple-600 bg-purple-500/10 border-purple-500/20",
  };

  return (
    <div className="bg-bg-card border border-border-main rounded-2xl p-6 shadow-sm premium-card">
      <h3 className="text-sm font-black text-text-main mb-6 uppercase tracking-widest">
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {actions.map((action, index) => (
          <button
            key={index}
            className="flex flex-col items-center justify-center p-5 rounded-2xl bg-bg-main hover:bg-bg-card border-2 border-transparent hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group active:scale-95"
          >
            <div
              className={`mb-3 w-12 h-12 flex items-center justify-center rounded-xl border transition-all duration-300 ${colorClasses[action.color]} group-hover:scale-110 shadow-sm`}
            >
              <span className="material-symbols-outlined text-[24px]">{action.icon}</span>
            </div>
            <span className="text-[10px] font-black text-text-muted uppercase tracking-tighter group-hover:text-primary transition-colors">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;




