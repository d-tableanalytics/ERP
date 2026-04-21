import React, { useState, useEffect } from 'react';
import {
    X, Info, AlignLeft, User, Calendar, CheckCircle2,
    MoreVertical, ArrowLeft, Loader2, MessageSquare,
    ChevronRight, Clock, AlertCircle, PlayCircle,
    Paperclip, Mic, ShieldCheck, Trash2, Tag,
    Bell, BellOff, CheckSquare, Check, Layers, Plus, Pencil, ChevronDown,
    MessageCircle, History, Users, Download, Image as ImageIcon,
    FileText, Maximize2, Pause, Volume2, ExternalLink
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import delegationService from '../../services/delegationService';
import teamService from '../../services/teamService';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import TaskCreationForm from './TaskCreationForm';
import TaskRemindersModal from './TaskRemindersModal';
import CompleteTaskModal from './CompleteTaskModal';

import usePermissions from '../../hooks/usePermissions';

const TaskDetailsDrawer = ({ isOpen, onClose, taskId, onSuccess }) => {
    const { can, userId: loggedInUserId } = usePermissions();
    const [task, setTask] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('');
    const [nextRevisedDate, setNextRevisedDate] = useState('');
    const [remark, setRemark] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isSubtaskModalOpen, setIsSubtaskModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isRemindersModalOpen, setIsRemindersModalOpen] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [subtasksExpanded, setSubtasksExpanded] = useState(true);
    const [previewImage, setPreviewImage] = useState(null);

    useEffect(() => {
        if (isOpen && taskId) {
            fetchInitialData();
        }
    }, [isOpen, taskId]);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            setError(null);
            const [taskRes, usersRes] = await Promise.all([
                delegationService.getDelegationById(taskId),
                teamService.getUsers()
            ]);
            setTask(taskRes.data);
            setUsers(usersRes);
            setStatus(taskRes.data.status);
        } catch (err) {
            console.error('Failed to fetch initial data:', err);
            setError('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const fetchTaskDetails = async () => {
        try {
            const response = await delegationService.getDelegationById(taskId);
            setTask(response.data);
            setStatus(response.data.status);
        } catch (err) {
            console.error('Failed to fetch task details:', err);
        }
    };

    const handleQuickAction = (action) => {
        if (action === 'Completed') {
            let parsedChecklist = [];
            try {
                parsedChecklist = typeof task.checklistItems === 'string'
                    ? JSON.parse(task.checklistItems)
                    : (task.checklistItems || []);
            } catch (e) { }

            if (parsedChecklist.length > 0 && parsedChecklist.some(item => !item.completed)) {
                toast.error('Please complete all checklist items before marking the task as Completed.');
                return;
            }
        }
        setStatus(action);
    };

    const handleToggleChecklistItem = async (index) => {
        try {
            setSubmitting(true);
            let parsedChecklist = [];
            try {
                parsedChecklist = typeof task.checklistItems === 'string'
                    ? JSON.parse(task.checklistItems)
                    : (task.checklistItems || []);
            } catch (e) { }

            const updatedChecklist = [...parsedChecklist];
            updatedChecklist[index].completed = !updatedChecklist[index].completed;

            // Optimistic update
            setTask({ ...task, checklistItems: updatedChecklist });

            const storedUser = JSON.parse(localStorage.getItem('user'));
            const userId = storedUser?.user?.id || storedUser?.id;

            await delegationService.updateDelegation(taskId, {
                checklistItems: updatedChecklist,
                changedBy: userId,
                reason: `Checklist item '${updatedChecklist[index].itemName || updatedChecklist[index].text}' marked as ${updatedChecklist[index].completed ? 'completed' : 'incomplete'}.`
            });

            if (onSuccess) onSuccess();
        } catch (err) {
            console.error('Failed to update checklist item:', err);
            toast.error('Failed to update checklist');
            // Revert changes on error
            fetchTaskDetails();
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmitUpdate = async () => {
        const statusChanged = status !== task.status;
        if (!remark.trim() && !statusChanged) return;

        try {
            setSubmitting(true);
            setError(null);

            const storedUser = JSON.parse(localStorage.getItem('user'));
            const userId = storedUser?.user?.id || storedUser?.id;

            // 1. If status changed, handle according to type
            if (statusChanged) {
                if (status === 'Completed' && task.evidenceRequired) {
                    // Remarks will be lost if we don't handle them or modal doesn't.
                    // For now, let's submit remark then show modal.
                    if (remark.trim()) {
                        await delegationService.addRemark(taskId, {
                            userId,
                            remark: remark.trim()
                        });
                        setRemark('');
                    }
                    setShowCompleteModal(true);
                    setSubmitting(false);
                    return;
                }

                await delegationService.updateDelegation(taskId, {
                    status: status,
                    changedBy: userId,
                    reason: remark.trim() || `Status updated to ${status}`
                });
            }

            // 2. Add remark if not already consumed by status update reason
            // (Note: updateDelegation in backend often creates a revision record from 'reason', 
            // but addRemark adds to the remarks history specifically)
            if (remark.trim()) {
                await delegationService.addRemark(taskId, {
                    userId,
                    remark: remark.trim()
                });
                setRemark('');
            }

            toast.success('Update submitted successfully');
            await fetchTaskDetails();
            if (onSuccess) onSuccess();

        } catch (err) {
            console.error('Failed to submit update:', err);
            setError('Failed to submit update');
            toast.error('Failed to update task');
        } finally {
            setSubmitting(false);
        }
    };

    const getUserName = (userId) => {
        const user = users.find(u => u.userId === userId);
        return user ? `${user.firstName} ${user.lastName}` : `User ${userId}`;
    };

    const getUserInitial = (userId) => {
        const user = users.find(u => u.userId === userId);
        return user ? user.firstName.charAt(0).toUpperCase() : '?';
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Completed': return <CheckCircle2 size={16} className="text-emerald-500" />;
            case 'In Progress': return <PlayCircle size={16} className="text-orange-500" />;
            case 'Pending': return <Clock size={16} className="text-slate-400" />;
            case 'Overdue': return <AlertCircle size={16} className="text-red-500" />;
            case 'Need Revision': return <MessageSquare size={16} className="text-blue-500" />;
            default: return <Clock size={16} className="text-slate-400" />;
        }
    };

    const handleDeleteTask = async () => {
        try {
            setSubmitting(true);
            await delegationService.deleteDelegation(taskId);
            toast.success('Task deleted successfully');
            setShowDeleteConfirm(false);
            onClose();
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error('Failed to delete task:', err);
            toast.error('Failed to delete task');
        } finally {
            setSubmitting(false);
        }
    };

    const getCurrentUserId = () => {
        const storedUser = JSON.parse(localStorage.getItem('user'));
        return storedUser?.user?.id || storedUser?.id;
    };

    const isAssigner = () => task?.assignerId === getCurrentUserId();
    const isDoer = () => task?.doerId === getCurrentUserId();
    const isAssignerOrDoer = () => task?.assignerId === getCurrentUserId() || task?.doerId === getCurrentUserId();

    const getLoopIds = () => typeof task?.inLoopIds === 'string' ? JSON.parse(task?.inLoopIds) : (task?.inLoopIds || []);
    const isSubscribed = () => {
        const loopIds = getLoopIds();
        return Array.isArray(loopIds) && loopIds.includes(getCurrentUserId());
    };

    const handleSubscribeToggle = async () => {
        if (!task) return;

        const currentUserId = getCurrentUserId();
        let loopIds = getLoopIds();

        // Prevent removing if already subscribed per user request
        if (loopIds.includes(currentUserId)) {
            toast.success('You are already subscribed to this task.');
            return;
        }

        try {
            setSubmitting(true);
            if (!Array.isArray(loopIds)) loopIds = [];

            loopIds = [...loopIds, currentUserId];

            await delegationService.updateDelegation(taskId, { inLoopIds: loopIds });
            await fetchTaskDetails();
            toast.success('Subscribed to task!');
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error('Failed to toggle subscription:', err);
            toast.error('Failed to update subscription');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateSubtaskStatus = async (subtaskId, newStatus) => {
        try {
            setSubmitting(true);
            const storedUser = JSON.parse(localStorage.getItem('user'));
            const userId = storedUser?.user?.id || storedUser?.id;

            await delegationService.updateDelegation(subtaskId, {
                status: newStatus,
                changedBy: userId,
                reason: `Subtask status updated to ${newStatus}`
            });

            toast.success(`Subtask marked as ${newStatus}`);
            await fetchTaskDetails();
        } catch (err) {
            console.error('Failed to update subtask status:', err);
            toast.error('Failed to update subtask status');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveReminders = async (reminders) => {
        try {
            setSubmitting(true);
            const storedUser = JSON.parse(localStorage.getItem('user'));
            const userId = storedUser?.user?.id || storedUser?.id;

            await delegationService.updateDelegation(taskId, {
                reminders: reminders,
                changedBy: userId,
                reason: 'Task reminders updated'
            });

            toast.success('Reminders saved successfully');
            setIsRemindersModalOpen(false);
            await fetchTaskDetails();
        } catch (err) {
            console.error('Failed to save reminders:', err);
            toast.error('Failed to save reminders');
        } finally {
            setSubmitting(false);
        }
    };


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] overflow-hidden">
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-300"
                onClick={onClose}
            />

            <div className="absolute right-0 top-0 h-full w-full max-w-4xl bg-white dark:bg-slate-900 shadow-2xl transition-transform duration-300 transform translate-x-0 border-l border-slate-100 dark:border-slate-800 flex flex-col">
                <div className="px-4.5 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 z-[60]">
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                            <ArrowLeft size={16} />
                        </button>
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-tight">
                            <span>Delegations</span>
                            <ChevronRight size={10} className="text-slate-300" />
                            <span className="text-emerald-500">Details</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`px-2.5 py-1 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 text-[10px] font-black rounded-lg border border-slate-100 dark:border-slate-800 uppercase flex items-center gap-1.5 shadow-sm`}>
                            {getStatusIcon(task?.status)}
                            {task?.status}
                        </div>
                        {(() => {
                            const deletePerm = can('task', 'delete');
                            let showDelete = false;
                            if (deletePerm === true || deletePerm === 'All') showDelete = true;
                            else if (deletePerm === 'Assigned' && isAssigner()) showDelete = true;
                            else if (deletePerm === 'Assignee' && isDoer()) showDelete = true;
                            else if (deletePerm === 'Both' && (isAssigner() || isDoer())) showDelete = true;

                            return showDelete && (
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    disabled={submitting}
                                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-lg transition-all"
                                    title="Delete Task"
                                >
                                    <Trash2 size={16} />
                                </button>
                            );
                        })()}
                    </div>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="animate-spin text-emerald-500" size={32} />
                            <p className="text-sm font-medium text-[var(--text-secondary)]">Loading task details...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex-1 flex items-center justify-center p-6">
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-xl flex flex-col items-center gap-3 max-w-md text-center">
                            <AlertCircle size={32} />
                            <p className="font-bold">{error}</p>
                            <button
                                onClick={fetchInitialData}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-4.5 space-y-4.5 custom-scrollbar bg-slate-50/30 dark:bg-slate-950/30">
                        <h1 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight leading-tight">{task.taskTitle}</h1>



                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                            <div className="lg:col-span-2 space-y-5">
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4.5 shadow-sm">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-500">
                                            <Info size={14} />
                                        </div>
                                        <h2 className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest opacity-80">Core Information</h2>
                                    </div>

                                    <div className="flex flex-wrap items-start gap-x-10 gap-y-6">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Category</label>
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-lg">
                                                    <Tag size={13} />
                                                </div>
                                                <span className="text-xs font-black text-slate-700 dark:text-slate-200">{task.category || 'N/A'}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Priority</label>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${task.priority === 'Urgent' ? 'bg-red-500 shadow-red-500/20' :
                                                    task.priority === 'High' ? 'bg-orange-500 shadow-orange-500/20' :
                                                        task.priority === 'Medium' ? 'bg-indigo-500 shadow-indigo-500/20' : 'bg-slate-400'
                                                    } shadow-lg`} />
                                                <span className="text-xs font-black text-slate-700 dark:text-slate-200">{task.priority}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Deadline</label>
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-lg">
                                                    <Calendar size={13} />
                                                </div>
                                                <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                                                    {task.dueDate ? new Date(task.dueDate).toLocaleString('en-GB', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        hour12: true
                                                    }) : 'Not set'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Evidence</label>
                                            <div className="flex items-center gap-2">
                                                <div className={`p-1.5 rounded-lg ${task.evidenceRequired ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>
                                                    <ShieldCheck size={13} />
                                                </div>
                                                <span className="text-xs font-black text-slate-700 dark:text-slate-200">{task.evidenceRequired ? 'Required' : 'Optional'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {(() => {
                                        let parsedTags = [];
                                        if (task.tags) {
                                            try { parsedTags = typeof task.tags === 'string' ? JSON.parse(task.tags) : task.tags; } catch (e) { }
                                            if (!Array.isArray(parsedTags)) parsedTags = [];
                                        }
                                        if (parsedTags.length === 0) return null;
                                        return (
                                            <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 space-y-3">
                                                <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Task Tags</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {parsedTags.map((tag, i) => {
                                                        const color = tag.color || '#64748b';
                                                        const text = tag.text || tag || '';
                                                        return (
                                                            <div
                                                                key={i}
                                                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border uppercase text-[9px] font-black tracking-tight shadow-sm transition-all"
                                                                style={{ backgroundColor: `${color}08`, borderColor: `${color}25`, color: color }}
                                                            >
                                                                <Tag size={9} strokeWidth={3} className="shrink-0" />
                                                                {text}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* CHECKLIST SECTION */}
                                {(() => {
                                    let parsedChecklist = [];
                                    try {
                                        parsedChecklist = typeof task.checklistItems === 'string'
                                            ? JSON.parse(task.checklistItems)
                                            : (task.checklistItems || []);
                                    } catch (e) { }

                                    if (!parsedChecklist || parsedChecklist.length === 0) return null;

                                    const completedCount = parsedChecklist.filter(item => item.completed).length;

                                    return (
                                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4.5 shadow-sm">
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-500">
                                                    <CheckSquare size={14} />
                                                </div>
                                                <h2 className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest opacity-80">Checklist</h2>
                                                <span className="ml-auto text-[9px] font-black text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                                    {completedCount} / {parsedChecklist.length}
                                                </span>
                                            </div>
                                            <div className="space-y-3">
                                                {parsedChecklist.map((item, idx) => (
                                                    <div key={idx} className="flex items-center gap-3 group">
                                                        <button
                                                            onClick={() => handleToggleChecklistItem(idx)}
                                                            disabled={submitting || !isDoer()}
                                                            className={`shrink-0 w-4.5 h-4.5 rounded-lg border transition-all flex items-center justify-center ${item.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 bg-slate-50 dark:bg-slate-800 hover:border-emerald-500'} disabled:opacity-50 disabled:cursor-not-allowed shadow-sm`}
                                                        >
                                                            {item.completed && <Check size={10} strokeWidth={4} />}
                                                        </button>
                                                        <span className={`text-xs font-black leading-snug flex-1 ${item.completed ? 'text-slate-400 line-through' : 'text-slate-600 dark:text-slate-300'}`}>
                                                            {item.itemName || item.text}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* SUBTASKS SECTION */}
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4.5 shadow-sm">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-1.5 bg-sky-50 dark:bg-sky-900/20 rounded-lg text-sky-500">
                                            <Layers size={14} />
                                        </div>
                                        <h2 className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest opacity-80">Sub Tasks</h2>
                                        <div className="flex items-center gap-2 ml-4">
                                            <div className="px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 text-[9px] font-black text-slate-500">
                                                {task.subtasks?.filter(s => s.status === 'Completed').length || 0} / {task.subtasks?.length || 0}
                                            </div>
                                            <button
                                                onClick={() => setIsSubtaskModalOpen(true)}
                                                className="w-6 h-6 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-sky-500 hover:text-white flex items-center justify-center text-slate-400 transition-all border border-slate-100 dark:border-slate-800 shadow-sm"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => setSubtasksExpanded(!subtasksExpanded)}
                                            className="ml-auto p-1.5 text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 dark:bg-slate-800 rounded-lg"
                                        >
                                            <ChevronDown size={14} className={`transition-transform duration-300 ${subtasksExpanded ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>

                                    {subtasksExpanded && (
                                        <div className="space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-300">
                                            {task.subtasks && task.subtasks.length > 0 ? (
                                                task.subtasks.map((sub, idx) => (
                                                    <div
                                                        key={sub.id}
                                                        className="p-3.5 rounded-2xl border border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 hover:border-emerald-500/30 transition-all cursor-pointer group shadow-sm"
                                                    >
                                                        <div className="flex justify-between items-start mb-2.5">
                                                            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">T-{idx + 1} &nbsp; {sub.taskTitle}</h3>
                                                            <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest whitespace-nowrap">
                                                                {(() => {
                                                                    const diff = Math.floor((new Date() - new Date(sub.createdAt)) / 60000);
                                                                    return diff < 60 ? `${diff}M AGO` : new Date(sub.createdAt).toLocaleDateString();
                                                                })()}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                            <div className="flex items-center gap-1.5 text-rose-500 bg-rose-50 dark:bg-rose-900/10 px-2 py-1 rounded-lg">
                                                                <Clock size={10} />
                                                                 {sub.dueDate ? new Date(sub.dueDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'NA'}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm">
                                                                <div className={`w-1.5 h-1.5 rounded-full ${sub.status === 'Completed' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : 'bg-orange-500 shadow-lg shadow-orange-500/30'}`} />
                                                                <span className={sub.status === 'Completed' ? 'text-emerald-500' : 'text-orange-500'}>{sub.status}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm">
                                                                <User size={10} />
                                                                {getUserName(sub.doerId).split(' ')[0]}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2 mt-4">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleUpdateSubtaskStatus(sub.id, 'In Progress');
                                                                }}
                                                                disabled={submitting || sub.status === 'In Progress'}
                                                                className="px-3 py-1.5 rounded-lg border border-orange-100 dark:border-orange-900/30 text-orange-500 bg-white dark:bg-slate-900 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-[9px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                                                            >
                                                                <PlayCircle size={10} /> In Progress
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleUpdateSubtaskStatus(sub.id, 'Completed');
                                                                }}
                                                                disabled={submitting || sub.status === 'Completed'}
                                                                className="px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30 text-emerald-500 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-[9px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                                                            >
                                                                <CheckCircle2 size={10} /> Complete
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-6 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No sub tasks yet</p>
                                                    <button
                                                        onClick={() => setIsSubtaskModalOpen(true)}
                                                        className="mt-3 text-[10px] font-black text-sky-500 hover:text-sky-600 flex items-center gap-1.5 mx-auto bg-sky-50 dark:bg-sky-900/20 px-3 py-1.5 rounded-lg border border-sky-100 dark:border-sky-900 shadow-sm"
                                                    >
                                                        <Plus size={12} strokeWidth={3} /> CREATE SUB TASK
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {isAssignerOrDoer() ? (
                                <div className="space-y-4 pt-2">
                                    <h2 className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest opacity-80">Quick Actions</h2>

                                        <div className="flex flex-wrap gap-2.5">
                                            {isDoer() && (
                                                <>
                                                    <button
                                                        onClick={() => handleQuickAction('In Progress')}
                                                        disabled={submitting || task?.status === 'Completed'}
                                                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest shadow-sm active:scale-95 ${
                                                            status === 'In Progress' 
                                                            ? 'bg-orange-500 text-white border-orange-500 shadow-orange-500/20' 
                                                            : 'bg-white dark:bg-slate-900 text-orange-600 border-orange-100 dark:border-orange-900/30 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                                                        } disabled:opacity-50`}
                                                    >
                                                        <PlayCircle size={14} /> In Progress
                                                    </button>
                                                    <button
                                                        onClick={() => handleQuickAction('Completed')}
                                                        disabled={submitting}
                                                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest shadow-sm active:scale-95 ${
                                                            status === 'Completed' 
                                                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-emerald-500/20' 
                                                            : 'bg-white dark:bg-slate-900 text-emerald-600 border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                                                        } disabled:opacity-50`}
                                                    >
                                                        <CheckCircle2 size={14} /> Complete
                                                    </button>
                                                    <button
                                                        onClick={() => setIsRemindersModalOpen(true)}
                                                        disabled={submitting}
                                                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm active:scale-95 bg-white dark:bg-slate-900"
                                                    >
                                                        <Bell size={14} /> REMINDERS
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={() => document.getElementById('remark-input')?.focus()}
                                                className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-blue-100 dark:border-blue-900/30 transition-all font-black text-[10px] uppercase tracking-widest bg-white dark:bg-slate-900 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 shadow-sm active:scale-95"
                                            >
                                                <MessageSquare size={14} /> Comment
                                            </button>
                                            <button
                                                onClick={() => setIsSubtaskModalOpen(true)}
                                                className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-sky-100 dark:border-sky-900/30 transition-all font-black text-[10px] uppercase tracking-widest bg-white dark:bg-slate-900 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 shadow-sm active:scale-95"
                                            >
                                                <Layers size={14} /> Sub Task
                                            </button>
                                            {isAssigner() && (
                                                <button
                                                    onClick={() => setIsEditModalOpen(true)}
                                                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-purple-100 dark:border-purple-900/30 transition-all font-black text-[10px] uppercase tracking-widest bg-white dark:bg-slate-900 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 shadow-sm active:scale-95"
                                                >
                                                    <Pencil size={14} /> Edit
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-3 mt-4">
                                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{isDoer() ? "Quick Remark" : "Remark (Assigner)"}</label>
                                            <div className="relative group">
                                                <textarea
                                                    id="remark-input"
                                                    value={remark}
                                                    onChange={(e) => setRemark(e.target.value)}
                                                    placeholder="Focus on specific details or updates..."
                                                    rows={2}
                                                    className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-[13px] text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500/30 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 resize-none font-medium leading-relaxed"
                                                />
                                                <div className="flex justify-end mt-2">
                                                    <button
                                                        onClick={handleSubmitUpdate}
                                                        disabled={submitting || (!remark.trim() && status === task.status)}
                                                        className={`py-2 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 ${
                                                            (remark.trim() || status !== task.status)
                                                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                                        }`}
                                                    >
                                                        {submitting ? 'SUBMITTING...' : 'SUBMIT UPDATE'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-5 shadow-sm flex flex-col items-center justify-center text-center space-y-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSubscribed() ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                            {isSubscribed() ? <Bell size={20} /> : <BellOff size={20} />}
                                        </div>
                                        <div>
                                            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-tight">Observer Mode</h3>
                                            <p className="text-[10px] text-[var(--text-secondary)] mt-1 max-w-sm uppercase font-bold tracking-widest opacity-70 leading-relaxed">
                                                {isSubscribed() ? "You are currently subscribed." : "Subscribe to receive updates."}
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleSubscribeToggle}
                                            disabled={submitting || isSubscribed()}
                                            className={`px-5 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${isSubscribed()
                                                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30'
                                                }`}
                                        >
                                            {isSubscribed() ? (
                                                <>
                                                    <CheckCircle2 size={14} /> Subscribed
                                                </>
                                            ) : (
                                                <>
                                                    <Bell size={14} /> Subscribe
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                                
                                {/* ATTACHMENTS SECTION */}
                                {((task.voiceNoteUrl || task.referenceDocs) && (
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4.5 shadow-sm">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="p-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-orange-500">
                                                <Paperclip size={14} />
                                            </div>
                                            <h2 className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest opacity-80">Attachments</h2>
                                        </div>
                                        
                                        <div className="space-y-4">
                                            {/* Voice Note */}
                                            {task.voiceNoteUrl && (
                                                <div className="p-3.5 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                            <Mic size={14} className="text-emerald-500" />
                                                            Voice Note
                                                        </div>
                                                        <a 
                                                            href={task.voiceNoteUrl} 
                                                            download 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-emerald-500 shadow-sm"
                                                            title="Download Voice Note"
                                                        >
                                                            <Download size={14} />
                                                        </a>
                                                    </div>
                                                    <audio 
                                                        controls 
                                                        src={task.voiceNoteUrl} 
                                                        className="w-full h-8 accent-emerald-500"
                                                    >
                                                        Your browser does not support the audio element.
                                                    </audio>
                                                </div>
                                            )}

                                            {/* Reference Documents / Images */}
                                            {task.referenceDocs && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {task.referenceDocs.split(',').filter(Boolean).map((url, idx) => {
                                                        const isImage = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url);
                                                        const fileName = url.split('/').pop().replace(/^\d+-/, '');

                                                        return (
                                                            <div key={idx} className="relative group p-2 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-emerald-500/30 transition-all flex flex-col gap-2">
                                                                {isImage ? (
                                                                    <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 border border-slate-100 dark:border-slate-800">
                                                                        <img 
                                                                            src={url} 
                                                                            alt={`Attachment ${idx + 1}`} 
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                                                                            <button 
                                                                                onClick={() => setPreviewImage(url)}
                                                                                className="p-2 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full text-white transition-all shadow-lg"
                                                                            >
                                                                                <Maximize2 size={16} />
                                                                            </button>
                                                                            <a 
                                                                                href={url} 
                                                                                download 
                                                                                target="_blank" 
                                                                                rel="noopener noreferrer"
                                                                                className="p-2 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full text-white transition-all shadow-lg"
                                                                            >
                                                                                <Download size={16} />
                                                                            </a>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-3 p-1">
                                                                        <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500 shrink-0">
                                                                            <FileText size={20} />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-[10px] font-black text-slate-700 dark:text-slate-200 truncate pr-6">{fileName}</p>
                                                                            <a 
                                                                                href={url} 
                                                                                target="_blank" 
                                                                                rel="noopener noreferrer"
                                                                                className="text-[9px] font-black text-emerald-500 hover:text-emerald-600 uppercase tracking-widest flex items-center gap-1"
                                                                            >
                                                                                View File <Download size={8} />
                                                                            </a>
                                                                        </div>
                                                                        <a 
                                                                            href={url} 
                                                                            download 
                                                                            target="_blank" 
                                                                            rel="noopener noreferrer"
                                                                            className="absolute right-2 top-2 p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-all"
                                                                        >
                                                                            <Download size={14} />
                                                                        </a>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {task.evidenceUrl && (
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4.5 shadow-sm">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-emerald-500">
                                                <ShieldCheck size={14} />
                                            </div>
                                            <h2 className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest opacity-80">Evidence Provided</h2>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {(() => {
                                                let evidenceUrls = [];
                                                try {
                                                    const parsed = JSON.parse(task.evidenceUrl);
                                                    evidenceUrls = Array.isArray(parsed) ? parsed : [task.evidenceUrl];
                                                } catch (e) {
                                                    evidenceUrls = task.evidenceUrl.split(',').filter(Boolean);
                                                }
                                                
                                                return evidenceUrls.map((url, idx) => {
                                                    const isImage = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url);
                                                    const fileName = url.split('/').pop().replace(/^\d+-/, '');

                                                    return (
                                                        <div key={idx} className="relative group p-2 bg-emerald-50/30 dark:bg-emerald-500/5 rounded-xl border border-emerald-100 dark:border-emerald-500/20 hover:border-emerald-500/40 transition-all flex flex-col gap-2 shadow-sm">
                                                            {isImage ? (
                                                                <div className="relative aspect-video rounded-lg overflow-hidden bg-white dark:bg-slate-800 border border-emerald-100 dark:border-emerald-900/20">
                                                                    <img src={url} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover" />
                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                                                                        <button onClick={() => setPreviewImage(url)} className="p-2 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full text-white transition-all shadow-lg"><Maximize2 size={16} /></button>
                                                                        <a href={url} download target="_blank" rel="noopener noreferrer" className="p-2 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full text-white transition-all shadow-lg"><Download size={16} /></a>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-3 p-1">
                                                                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 shrink-0"><FileText size={20} /></div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-[10px] font-black text-slate-700 dark:text-slate-200 truncate pr-6">{fileName}</p>
                                                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[9px] font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-widest flex items-center gap-1">View Evidence <ExternalLink size={8} /></a>
                                                                    </div>
                                                                    <a href={url} download target="_blank" rel="noopener noreferrer" className="absolute right-2 top-2 p-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-800 rounded-lg text-emerald-600 transition-all"><Download size={14} /></a>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                )}

                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4.5 shadow-sm">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-1.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-500">
                                            <History size={14} />
                                        </div>
                                        <h2 className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest opacity-80">Revision History</h2>
                                    </div>
                                    <div className="space-y-4 relative before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-slate-100 dark:before:bg-slate-800">
                                        {task.revision_history && task.revision_history.length > 0 ? (
                                            task.revision_history.map((rev, i) => (
                                                <div key={i} className="relative pl-7 group">
                                                    <div className="absolute left-0 top-1.5 w-5 h-5 rounded-full bg-white dark:bg-slate-900 border-2 border-purple-500 z-10 shadow-sm transition-transform group-hover:scale-110" />
                                                    <div className="p-3 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl border border-slate-50 dark:border-slate-800 shadow-sm">
                                                        <div className="flex justify-between items-center mb-1.5">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`px-2 py-0.5 text-[9px] font-black rounded-lg uppercase border ${rev.newStatus === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                                    rev.newStatus === 'In Progress' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                                                        rev.newStatus === 'Need Revision' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                                            'bg-slate-50 text-slate-600 border-slate-100'
                                                                    }`}>
                                                                    {rev.newStatus}
                                                                </div>
                                                                <span className="text-[9px] font-black text-slate-400">
                                                                    {new Date(rev.createdAt).toLocaleString()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {rev.reason && (
                                                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 italic mb-2">"{rev.reason}"</p>
                                                        )}
                                                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                            <span>BY: {getUserName(rev.changedBy).split(' ')[0]}</span>
                                                            <span className="line-through">OLD: {rev.oldStatus}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-6 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No revisions logged</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4.5 shadow-sm">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-500">
                                            <MessageCircle size={14} />
                                        </div>
                                        <h2 className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest opacity-80">Remark History</h2>
                                    </div>
                                    <div className="space-y-4 relative before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-slate-100 dark:before:bg-slate-800">
                                        {task.remarks && task.remarks.length > 0 ? (
                                            task.remarks.map((r, i) => (
                                                <div key={i} className="relative pl-7 group">
                                                    <div className="absolute left-0 top-1.5 w-5 h-5 rounded-full bg-white dark:bg-slate-900 border-2 border-blue-500 z-10 shadow-sm transition-transform group-hover:scale-110" />
                                                    <div className="p-3 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl border border-slate-50 dark:border-slate-800 shadow-sm flex gap-3.5">
                                                        <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500 shadow-sm shrink-0">
                                                            {getUserInitial(r.userId)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{getUserName(r.userId).split(' ')[0]}</span>
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{new Date(r.createdAt).toLocaleDateString()}</span>
                                                            </div>
                                                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed italic">"{r.remark}"</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-6 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No remarks yet</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-5">
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4.5 shadow-sm space-y-4.5">
                                    <h2 className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest opacity-80 flex items-center gap-2">
                                        <Users size={14} className="text-indigo-500" />
                                        Involved Parties
                                    </h2>

                                    <div className="flex items-center gap-3.5 group">
                                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-sm transition-transform group-hover:scale-105 shadow-sm border border-indigo-100 dark:border-indigo-900/30">
                                            {getUserInitial(task.assignerId)}
                                        </div>
                                        <div className="space-y-0.5">
                                            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Assigned By</label>
                                            <p className="text-xs font-black text-slate-700 dark:text-slate-200">{getUserName(task.assignerId)}</p>
                                        </div>
                                    </div>

                                    <div className="h-px bg-slate-50 dark:bg-slate-800" />

                                    <div className="flex items-center gap-3.5 group">
                                        <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-500 font-black text-sm transition-transform group-hover:scale-105 shadow-sm border border-amber-100 dark:border-amber-900/30">
                                            {getUserInitial(task.doerId)}
                                        </div>
                                        <div className="space-y-0.5">
                                            <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Assigned To</label>
                                            <p className="text-xs font-black text-slate-700 dark:text-slate-200">{getUserName(task.doerId)}</p>
                                        </div>
                                    </div>

                                    {task.inLoopIds && Array.isArray(task.inLoopIds) && task.inLoopIds.length > 0 && (
                                        <>
                                            <div className="h-px bg-slate-50 dark:bg-slate-800" />
                                            <div className="space-y-3">
                                                <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">In Loop</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {[...new Set(task.inLoopIds)].map(userId => (
                                                        <div key={userId} className="flex items-center gap-2 bg-slate-50/50 dark:bg-slate-950/50 p-2 rounded-xl border border-slate-50 dark:border-slate-800 shadow-sm">
                                                            <div className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-indigo-500 dark:text-indigo-400 font-black text-[9px] border border-slate-100 dark:border-slate-800 shadow-sm">
                                                                {getUserInitial(userId)}
                                                            </div>
                                                            <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-tight">{getUserName(userId).split(' ')[0]}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Created On</span>
                                        <span className="text-[9px] font-black text-slate-700 dark:text-slate-200">
                                            {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Delegation ID</span>
                                        <span className="text-[9px] font-black text-slate-300 dark:text-slate-600">#{task.id?.substring(0, 8)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <ConfirmDeleteModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDeleteTask}
                message="Are you sure you want to delete this task? This action cannot be undone."
                loading={submitting}
            />

            {isSubtaskModalOpen && (
                <TaskCreationForm
                    isOpen={isSubtaskModalOpen}
                    onClose={() => setIsSubtaskModalOpen(false)}
                    onSuccess={fetchTaskDetails}
                    parentId={taskId}
                    initialData={{
                        groupId: task?.groupId,
                        inLoopIds: task?.inLoopIds
                    }}
                />
            )}

            {isEditModalOpen && (
                <TaskCreationForm
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onSuccess={() => {
                        fetchTaskDetails();
                        onSuccess?.();
                    }}
                    initialData={task}
                />
            )}

            {showCompleteModal && (
                <CompleteTaskModal
                    task={task}
                    isOpen={showCompleteModal}
                    onClose={() => setShowCompleteModal(false)}
                    onSuccess={() => {
                        setShowCompleteModal(false);
                        fetchTaskDetails();
                        if (onSuccess) onSuccess();
                    }}
                />
            )}

            <TaskRemindersModal
                isOpen={isRemindersModalOpen}
                onClose={() => setIsRemindersModalOpen(false)}
                onSave={handleSaveReminders}
                initialReminders={task?.reminders || []}
            />

            {/* Image Preview Modal */}
            {previewImage && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div 
                        className="absolute inset-0 bg-slate-900/90 backdrop-blur-md"
                        onClick={() => setPreviewImage(null)}
                    />
                    <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300">
                        <button 
                            onClick={() => setPreviewImage(null)}
                            className="absolute -top-12 right-0 p-2 text-white hover:bg-white/10 rounded-full transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest"
                        >
                            CLOSE <X size={20} />
                        </button>
                        <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-2xl relative">
                            <img 
                                src={previewImage} 
                                alt="Full preview" 
                                className="w-full h-auto max-h-[80vh] object-contain"
                            />
                            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate max-w-md">
                                    {previewImage.split('/').pop().replace(/^\d+-/, '')}
                                </span>
                                <a 
                                    href={previewImage} 
                                    download 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center gap-2"
                                >
                                    <Download size={14} /> DOWNLOAD FULL IMAGE
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskDetailsDrawer;
