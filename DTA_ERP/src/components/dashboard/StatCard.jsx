import React from "react";

const StatCard = ({
  title,
  value,
  icon,
  trend,
  trendLabel,
  color = "blue",
  onClick,
}) => {
  const colorClasses = {
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/50 dark:border-blue-500/20",
    green:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-500/20",
    orange:
      "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200/50 dark:border-orange-500/20",
    purple:
      "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200/50 dark:border-purple-500/20",
  };

  return (
    <div
      onClick={onClick}
      className={`premium-card premium-card-hover bg-bg-card p-6 flex flex-col justify-between h-[160px] ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-text-muted text-[10px] font-black uppercase tracking-widest mb-1.5">{title}</p>
          <h3 className="text-3xl font-black text-text-main tracking-tight leading-none">{value}</h3>
        </div>
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-sm ${colorClasses[color] || colorClasses.blue}`}
        >
          <span className="material-symbols-outlined text-[28px]">{icon}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-auto">
        <span
          className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
            trend.includes("Done") || trend.startsWith("+")
              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
              : trend.startsWith("-")
                ? "bg-red-500/10 text-red-600 border border-red-500/20"
                : "bg-primary/10 text-primary border border-primary/20"
          }`}
        >
          {trend}
        </span>
        <span className="text-text-muted text-[10px] font-bold uppercase tracking-tight">
          {trendLabel}
        </span>
      </div>
    </div>
  );
};

export default StatCard;




