import React from 'react';
import { 
    MoreVertical, Calendar, User, Tag, 
    AlertCircle, CheckCircle2, History as HistoryIcon,
    Clock, Paperclip, Mic
} from 'lucide-react';

const KanbanColumn = ({ title, tasks, color, icon: Icon, onTaskClick }) => {
    return (
        <div className="flex-1 min-w-[300px] bg-slate-50/50 dark:bg-slate-900/50 rounded-xl p-4 flex flex-col gap-4 border border-border-main">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${color} bg-bg-card shadow-sm border border-border-main`}>
                        <Icon size={16} />
                    </div>
                    <span className="text-sm font-black text-text-main uppercase tracking-wider">{title}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-black text-slate-500 uppercase">{tasks.length}</span>
                </div>
                <button className="text-slate-400 hover:text-slate-600 transition-colors">
                    <MoreVertical size={16} />
                </button>
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-25rem)] pr-1 custom-scrollbar">
                {tasks.map((task) => (
                    <div 
                        key={task.id} 
                        onClick={() => onTaskClick?.(task)}
                        className="bg-bg-card p-4 rounded-xl shadow-sm border border-border-main hover:shadow-md transition-all group cursor-pointer border-l-4 border-l-transparent hover:border-l-[#00d194]">
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="text-[13px] font-black text-slate-800 dark:text-white leading-tight group-hover:text-emerald-500 transition-colors">{task.taskTitle}</h4>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase ${
                                task.priority === 'High' ? 'bg-red-50 text-red-500' : 
                                task.priority === 'Medium' ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-blue-500'
                            }`}>
                                {task.priority || 'Low'}
                            </span>
                        </div>
                        
                        <p className="text-[11px] text-text-muted font-bold line-clamp-2 mb-3 leading-relaxed">
                            {task.description || 'No description provided'}
                        </p>

                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {task.tags && (typeof task.tags === 'string' ? JSON.parse(task.tags) : task.tags).map((tag, i) => (
                                <span 
                                    key={i} 
                                    className="flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md border"
                                    style={{ backgroundColor: `${tag.color}10`, borderColor: `${tag.color}30`, color: tag.color }}
                                >
                                    <Tag size={8} /> {tag.text}
                                </span>
                            ))}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-50 dark:border-slate-700/50">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center text-[10px] font-black text-sky-600 border border-white dark:border-slate-800">
                                    {(task.doerFirstName || task.doerName || 'U').substring(0, 2).toUpperCase()}
                                </div>
                                <span className="text-[10px] font-bold text-slate-400">{task.doerFirstName ? `${task.doerFirstName} ${task.doerLastName}` : task.doerName || 'Unassigned'}</span>
                                <div className="flex items-center gap-1.5 ml-2">
                                    {task.voiceNoteUrl && <Mic size={10} className="text-emerald-500" />}
                                    {task.referenceDocs && <Paperclip size={10} className="text-orange-500" />}
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-400">
                                <Calendar size={12} />
                                <span className="text-[10px] font-black">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const TaskKanbanView = ({ tasks, onTaskClick }) => {
    const columns = [
        { title: 'Pending', status: 'Pending', color: 'text-red-500', icon: AlertCircle },
        { title: 'Need Revision', status: 'Need Revision', color: 'text-blue-500', icon: HistoryIcon },
        { title: 'In Progress', status: 'In Progress', color: 'text-orange-400', icon: HistoryIcon },
        { title: 'Completed', status: 'Completed', color: 'text-emerald-500', icon: CheckCircle2 }
    ];

    return (
        <div className="flex gap-6 h-full pb-6 overflow-x-auto min-h-[500px] animate-in slide-in-from-bottom-4 duration-500">
            {columns.map((col) => (
                <KanbanColumn 
                    key={col.status}
                    title={col.title}
                    tasks={tasks.filter(t => t.status === col.status)}
                    color={col.color}
                    icon={col.icon}
                    onTaskClick={onTaskClick}
                />
            ))}
        </div>
    );
};

export default TaskKanbanView;



