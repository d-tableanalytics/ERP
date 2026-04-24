import React from "react";

const RecentActivity = () => {
  const activities = [
    {
      module: "Delegation",
      description: 'Task "Design Review" marked as COMPLETED',
      user: "Sarah Jenkins",
      time: "2 mins ago",
      status: "Completed",
      color: "blue",
    },
    {
      module: "Help Ticket",
      description: "Ticket #HT-2049 resolved: Printer setup",
      user: "Mike Ross",
      time: "15 mins ago",
      status: "Completed",
      color: "purple",
    },
    {
      module: "O2D",
      description: 'Order #ORD-992 moved to "Packaging"',
      user: "System",
      time: "1 hour ago",
      status: "Processing",
      color: "orange",
    },
    {
      module: "Checklist",
      description: "Daily safety check verified",
      user: "Warehouse Bot",
      time: "3 hours ago",
      status: "Completed",
      color: "emerald",
    },
  ];

  const statusClasses = {
    Completed:
      "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
    Pending:
      "bg-amber-500/10 text-amber-600 border border-amber-500/20",
    Processing:
      "bg-blue-500/10 text-blue-600 border border-blue-500/20",
  };

  const moduleColors = {
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    orange: "bg-orange-500",
    emerald: "bg-emerald-500",
  };

  return (
    <div className="bg-bg-card border border-border-main rounded-2xl p-6 shadow-sm overflow-hidden premium-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-black text-text-main uppercase tracking-widest leading-none mb-1.5">
            Recent Activity
          </h3>
          <p className="text-xs font-bold text-text-muted">
            Real-time log of company-wide updates
          </p>
        </div>
        <button className="text-[10px] font-black text-text-muted hover:text-primary flex items-center gap-1.5 transition-all uppercase tracking-widest px-3 py-1 bg-bg-main rounded-lg border border-border-main/50">
          Filter{" "}
          <span className="material-symbols-outlined text-[16px]">
            filter_list
          </span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-separate border-spacing-y-2">
          <thead>
            <tr className="text-[10px] text-text-muted font-black uppercase tracking-widest">
              <th className="px-4 py-2">Module</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2 text-right">Time</th>
              <th className="px-4 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((activity, index) => (
              <tr
                key={index}
                className="group hover:bg-bg-main transition-all duration-300 cursor-default"
              >
                <td className="px-4 py-4 font-bold text-text-main first:rounded-l-xl flex items-center gap-2.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shadow-sm ${moduleColors[activity.color]}`}
                  ></span>
                  <span className="text-xs uppercase tracking-tight font-black">{activity.module}</span>
                </td>
                <td className="px-4 py-4 text-text-main font-medium text-xs">
                  {activity.description}
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2.5">
                    <div className="bg-primary/10 text-primary text-[10px] font-black size-7 rounded-full flex items-center justify-center border border-primary/20 uppercase tracking-tighter">
                      {activity.user
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <span className="text-text-main text-xs font-black">
                      {activity.user}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 text-text-muted font-black text-[10px] uppercase tracking-tighter text-right">
                  {activity.time}
                </td>
                <td className="px-4 py-4 last:rounded-r-xl text-right">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${statusClasses[activity.status]}`}
                  >
                    {activity.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className="w-full mt-6 py-3 rounded-xl border-2 border-dashed border-border-main text-[10px] font-black text-text-muted hover:text-primary hover:border-primary/30 hover:bg-bg-main transition-all uppercase tracking-widest">
        View All Activity Logs
      </button>
    </div>
  );
};

export default RecentActivity;




