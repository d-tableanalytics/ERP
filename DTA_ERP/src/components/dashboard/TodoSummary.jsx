import React from "react";

const TodoSummary = () => {
  const tasks = [
    {
      title: "Update Delegation Report",
      due: "Due Today",
      module: "Delegation",
      completed: false,
    },
    {
      title: "Complete Morning Checklist",
      due: "Due in 1 hour",
      module: "Checklist",
      completed: false,
    },
    {
      title: "Verify Order #991 Status",
      due: "Completed",
      module: "O2D",
      completed: true,
    },
    {
      title: "Raise Ticket for IT Support",
      due: "Due Today",
      module: "Support",
      completed: false,
    },
  ];

  return (
    <div className="bg-bg-card border border-border-main rounded-2xl p-6 shadow-sm flex flex-col h-full premium-card">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-black text-text-main tracking-widest uppercase">
          Quick Tasks
        </h3>
        <button className="text-[10px] font-black text-primary hover:underline px-3 py-1 rounded-full bg-primary/10 uppercase tracking-wider transition-all">
          View All
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {tasks.map((task, index) => (
          <div
            key={index}
            className="flex items-start gap-4 p-3 rounded-xl hover:bg-bg-main transition-all duration-300 group cursor-pointer border border-transparent hover:border-border-main/50"
          >
            <div className="mt-0.5">
              <span
                className={`material-symbols-outlined text-[24px] ${task.completed ? "text-emerald-500" : "text-text-muted/30 group-hover:text-primary"} transition-colors`}
              >
                {task.completed ? "check_circle" : "circle"}
              </span>
            </div>
            <div className="flex-1">
              <p
                className={`text-sm font-bold leading-tight ${task.completed ? "text-text-muted/50 line-through font-medium" : "text-text-main"}`}
              >
                {task.title}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className={`text-[9px] font-black uppercase py-0.5 px-2 rounded-full border ${
                    task.due === "Completed"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : "bg-bg-main text-text-muted border-border-main"
                  }`}
                >
                  {task.due}
                </span>
                <span className="text-[10px] font-bold text-text-muted/20">
                  •
                </span>
                <span className="text-[9px] font-black text-primary/80 uppercase tracking-widest">
                  {task.module}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="mt-6 w-full py-3 bg-bg-main hover:bg-primary text-text-muted hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-border-main hover:border-primary shadow-sm active:scale-[0.98]">
        + Create New Task
      </button>
    </div>
  );
};

export default TodoSummary;




