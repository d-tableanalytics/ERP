import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle, CheckCircle2, PlayCircle, MoreVertical, FileText, ExternalLink, Paperclip } from 'lucide-react';
import delegationService from '../../services/delegationService';
import CompleteTaskModal from './CompleteTaskModal';
import TaskDetailsDrawer from './TaskDetailsDrawer';

const TaskTable = ({ type = 'assigned', search = '', department = '', startDate = '', endDate = '', tasks: providedTasks = null, onTasksLoaded = null }) => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(providedTasks === null);
    const [selectedTask, setSelectedTask] = useState(null);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState(null);

    useEffect(() => {
        if (providedTasks === null) {
            fetchTasks();
        } else {
            setTasks(providedTasks);
            setLoading(false);
            if (onTasksLoaded) onTasksLoaded(providedTasks);
        }
    }, [type, search, department, startDate, endDate, providedTasks]);

    const fetchTasks = async () => {
        try {
            setLoading(true);
            const storedUser = JSON.parse(localStorage.getItem('user'));
            const userId = storedUser?.user?.id || storedUser?.id;

            const filters = {
                search,
                category: department !== 'Category' ? department : undefined,
                startDate,
                endDate
            };

            if (type === 'assigned') {
                filters.doerId = userId;
            } else if (type === 'delegated') {
                filters.assignerId = userId;
            }

            const response = await delegationService.getDelegations(filters);
            setTasks(response.data || []);
            if (onTasksLoaded) onTasksLoaded(response.data || []);
        } catch (err) {
            console.error('Failed to fetch tasks:', err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Completed': return <CheckCircle2 size={16} className="text-emerald-500" />;
            case 'In Progress': return <PlayCircle size={16} className="text-orange-500" />;
            case 'Pending': return <Clock size={16} className="text-slate-400" />;
            case 'Overdue': return <AlertCircle size={16} className="text-red-500" />;
            default: return <Clock size={16} className="text-slate-400" />;
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'Urgent': return 'bg-red-100 text-red-700 border-red-200';
            case 'High': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'Medium': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Low': return 'bg-slate-100 text-slate-700 border-slate-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    if (loading) {
        return (
            <div className="w-full h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="w-full overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-secondary)">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-bg-main/50 border-b border-(--border-color)">
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Task Title</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Priority</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Due Date</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-(--border-color)">
                    {tasks.map((task) => (
                        <tr key={task.id} className="hover:bg-bg-main/30 transition-colors group">
                            <td className="px-6 py-4">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-text-main">{task.taskTitle}</span>
                                    <span className="text-xs text-slate-500 truncate max-w-[200px]">{task.description}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getPriorityColor(task.priority)}`}>
                                    {task.priority}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    {getStatusIcon(task.status)}
                                    <span className="text-xs font-medium text-text-muted">{task.status}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-xs text-text-muted font-medium">
                                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            setSelectedTaskId(task.id);
                                            setShowDetailsDrawer(true);
                                        }}
                                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition-all flex items-center gap-1"
                                        title="View Details"
                                    >
                                        <MoreVertical size={16} />
                                        <span className="text-[10px] font-bold group-hover:inline hidden">Details</span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {tasks.length === 0 && (
                        <tr>
                            <td colSpan="5" className="px-6 py-12 text-center text-slate-400 text-sm">
                                No tasks found
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {showCompleteModal && (
                <CompleteTaskModal
                    task={selectedTask}
                    isOpen={showCompleteModal}
                    onClose={() => setShowCompleteModal(false)}
                    onSuccess={() => {
                        setShowCompleteModal(false);
                        fetchTasks();
                    }}
                />
            )}

            {showDetailsDrawer && (
                <TaskDetailsDrawer
                    isOpen={showDetailsDrawer}
                    taskId={selectedTaskId}
                    onClose={() => setShowDetailsDrawer(false)}
                    onSuccess={fetchTasks}
                />
            )}
        </div>
    );
};

export default TaskTable;



