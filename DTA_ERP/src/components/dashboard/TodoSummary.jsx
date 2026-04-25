import React, { useState, useEffect } from "react";
import taskService from "../../services/taskService";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { calculateTaskStatus } from "../../utils/taskFilters";
import { Loader2, Plus, ArrowRight } from "lucide-react";

const TodoSummary = ({ onCreateTask }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const navigate = useNavigate();

  const fetchTasks = async () => {
    try {
      const data = await taskService.getMyTasks();
      // Only show top 5 pending/in-progress tasks
      const activeTasks = data
        .filter(t => t.status !== 'Completed')
        .slice(0, 5);
      setTasks(activeTasks);
    } catch (error) {
      console.error("Failed to fetch dashboard tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    
    // Listen for custom event or just refresh every minute if needed
    const interval = setInterval(fetchTasks, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleComplete = async (e, task) => {
    e.stopPropagation();
    if (updatingId) return;
    
    setUpdatingId(task.id);
    try {
      const newStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
      await taskService.updateTask(task.id, { status: newStatus });
      toast.success(newStatus === 'Completed' ? 'Task marked as completed' : 'Task reopened');
      fetchTasks();
    } catch (error) {
      toast.error("Failed to update task");
    } finally {
      setUpdatingId(null);
    }
  };

  const getDueLabel = (dueDate) => {
    if (!dueDate) return "No Date";
    const d = new Date(dueDate);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const taskDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    
    const diffTime = taskDay - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Due Today";
    if (diffDays === 1) return "Due Tomorrow";
    if (diffDays === -1) return "Yesterday";
    if (diffDays < 0) return "Overdue";
    return `In ${diffDays} days`;
  };

  return (
    <div className="bg-bg-card border border-border-main rounded-2xl p-6 shadow-sm flex flex-col h-full premium-card">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-black text-text-main tracking-widest uppercase">
          Quick Tasks
        </h3>
        <button 
          onClick={() => navigate("/tasks/my-tasks")}
          className="text-[10px] font-black text-primary hover:underline px-3 py-1 rounded-full bg-primary/10 uppercase tracking-wider transition-all flex items-center gap-1 group"
        >
          View All <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[320px] no-scrollbar">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-primary opacity-30" size={32} />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center opacity-60 h-full">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
              <Plus className="text-slate-400" />
            </div>
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">No active tasks</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {tasks.map((task) => {
              const displayStatus = calculateTaskStatus(task);
              const isCompleted = task.status === 'Completed';
              
              return (
                <div
                  key={task.id}
                  onClick={() => navigate(`/tasks/my-tasks?id=${task.id}`)}
                  className="flex items-start gap-4 p-3 rounded-xl hover:bg-bg-main transition-all duration-300 group cursor-pointer border border-transparent hover:border-border-main/50"
                >
                  <button
                    onClick={(e) => handleToggleComplete(e, task)}
                    disabled={updatingId === task.id}
                    className="mt-0.5 relative shrink-0"
                  >
                    {updatingId === task.id ? (
                      <Loader2 size={24} className="animate-spin text-primary" />
                    ) : (
                      <span
                        className={`material-symbols-outlined text-[24px] ${isCompleted ? "text-emerald-500" : "text-text-muted/30 group-hover:text-primary"} transition-colors`}
                      >
                        {isCompleted ? "check_circle" : "circle"}
                      </span>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-bold leading-tight truncate ${isCompleted ? "text-text-muted/50 line-through font-medium" : "text-text-main"}`}
                    >
                      {task.taskTitle}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className={`text-[9px] font-black uppercase py-0.5 px-2 rounded-full border ${
                          displayStatus === 'Overdue' 
                            ? 'bg-red-500/10 text-red-600 border-red-500/20'
                            : 'bg-bg-main text-text-muted border-border-main'
                        }`}
                      >
                        {getDueLabel(task.dueDate)}
                      </span>
                      <span className="text-[10px] font-bold text-text-muted/20">
                        •
                      </span>
                      <span className="text-[9px] font-black text-primary/80 uppercase tracking-widest truncate">
                        {task.category || "General"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button 
        onClick={onCreateTask}
        className="mt-6 w-full py-3 bg-bg-main hover:bg-primary text-text-muted hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-border-main hover:border-primary shadow-sm active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <Plus size={14} /> Create New Task
      </button>
    </div>
  );
};

export default TodoSummary;
