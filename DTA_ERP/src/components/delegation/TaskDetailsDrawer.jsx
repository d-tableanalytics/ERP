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
import CreateDelegationModal from './CreateDelegationModal';
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
        const user = users.find(u => u.userId === userId || u.id === userId);
        return user ? `${user.firstName} ${user.lastName}` : `User ${userId}`;
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Completed': return <CheckCircle2 size={16} className="text-[#137fec]" />;
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
                {/* Header */}
                <div className="px-4.5 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 z-[60]">
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
                            <ArrowLeft size={16} />
                        </button>
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-tight">
                            <span>Delegations</span>
                            <ChevronRight size={10} className="text-slate-300" />
                            <span className="text-[#137fec]">Details</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`px-2.5 py-1 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 text-[10px] font-black rounded-lg border border-slate-100 dark:border-slate-800 uppercase flex items-center gap-1.5 shadow-sm`}>
                            {getStatusIcon(task?.status)}
                            {task?.status}
                        </div>
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            disabled={submitting}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-lg transition-all"
                            title="Delete Task"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="animate-spin text-[#137fec]" size={32} />
                            <p className="text-sm font-medium text-slate-500">Loading task details...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex-1 flex items-center justify-center p-6">
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-xl flex flex-col items-center gap-3 max-w-md text-center">
                            <AlertCircle size={32} />
                            <p className="font-bold">{error}</p>
                            <button onClick={fetchInitialData} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors">Try Again</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-4.5 space-y-4.5 custom-scrollbar bg-slate-50/30 dark:bg-slate-950/30">
                        <h1 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight leading-tight">{task.taskTitle}</h1>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                            <div className="lg:col-span-2 space-y-5">
                                {/* Core Information */}
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
                                                <div className={`w-2 h-2 rounded-full ${task.priority === 'Urgent' ? 'bg-red-500 shadow-red-500/20' : task.priority === 'High' ? 'bg-orange-500 shadow-orange-500/20' : task.priority === 'Medium' ? 'bg-indigo-500 shadow-indigo-500/20' : 'bg-slate-400'} shadow-lg`} />
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
                                                    {task.dueDate ? new Date(task.dueDate).toLocaleString('en-GB') : 'Not set'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Checklist */}
                                {(() => {
                                    let parsedChecklist = [];
                                    try { parsedChecklist = typeof task.checklistItems === 'string' ? JSON.parse(task.checklistItems) : (task.checklistItems || []); } catch (e) { }
                                    if (!parsedChecklist || parsedChecklist.length === 0) return null;
                                    const completedCount = parsedChecklist.filter(item => item.completed).length;
                                    return (
                                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4.5 shadow-sm">
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="p-1.5 bg-[#137fec]/10 rounded-lg text-[#137fec]">
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
                                                            className={`shrink-0 w-4.5 h-4.5 rounded-lg border transition-all flex items-center justify-center ${item.completed ? 'bg-[#137fec] border-[#137fec] text-white' : 'border-slate-200 bg-slate-50 dark:bg-slate-800 hover:border-[#137fec]'} shadow-sm`}
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

                                {/* Quick Actions */}
                                {isAssignerOrDoer() && (
                                    <div className="space-y-4 pt-2">
                                        <h2 className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest opacity-80">Quick Actions</h2>
                                        <div className="flex flex-wrap gap-2.5">
                                            {isDoer() && (
                                                <>
                                                    <button onClick={() => handleQuickAction('In Progress')} className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest shadow-sm ${status === 'In Progress' ? 'bg-orange-500 text-white' : 'bg-white text-orange-600 border-orange-100'}`}><PlayCircle size={14}/> In Progress</button>
                                                    <button onClick={() => handleQuickAction('Completed')} className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest shadow-sm ${status === 'Completed' ? 'bg-[#137fec] text-white' : 'bg-white text-[#137fec] border-[#137fec]/20'}`}><CheckCircle2 size={14}/> Complete</button>
                                                </>
                                            )}
                                            <button onClick={() => setIsRemindersModalOpen(true)} className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest bg-white"><Bell size={14}/> REMINDERS</button>
                                        </div>
                                        
                                        <div className="space-y-3 mt-4">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quick Remark</label>
                                            <textarea
                                                value={remark}
                                                onChange={(e) => setRemark(e.target.value)}
                                                placeholder="Focus on specific details or updates..."
                                                rows={2}
                                                className="w-full bg-white border border-slate-100 rounded-2xl p-4 text-[13px] text-slate-700 focus:ring-4 focus:ring-[#137fec]/5 focus:border-[#137fec]/30 outline-none transition-all resize-none font-medium"
                                            />
                                            <div className="flex justify-end mt-2">
                                                <button
                                                    onClick={handleSubmitUpdate}
                                                    disabled={submitting || (!remark.trim() && status === task?.status)}
                                                    className={`py-2 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all ${ (remark.trim() || status !== task?.status) ? 'bg-[#137fec] text-white shadow-[#137fec]/20' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                                                >
                                                    {submitting ? 'SUBMITTING...' : 'SUBMIT UPDATE'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Sidebar Info */}
                            <div className="space-y-5">
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4.5 shadow-sm">
                                    <h3 className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest mb-4 opacity-80">Stakeholders</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs border border-indigo-100">{getUserName(task.assignerId).substring(0, 2).toUpperCase()}</div>
                                            <div>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Assigner</p>
                                                <p className="text-xs font-black text-slate-700 dark:text-slate-200">{getUserName(task.assignerId)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-xs border border-emerald-100">{getUserName(task.doerId).substring(0, 2).toUpperCase()}</div>
                                            <div>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Assignee</p>
                                                <p className="text-xs font-black text-slate-700 dark:text-slate-200">{getUserName(task.doerId)}</p>
                                            </div>
                                        </div>
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
                loading={submitting}
                message="Are you sure you want to delete this task? This action cannot be undone."
            />

            <TaskRemindersModal
                isOpen={isRemindersModalOpen}
                onClose={() => setIsRemindersModalOpen(false)}
                onSave={handleSaveReminders}
                initialReminders={typeof task?.reminders === 'string' ? JSON.parse(task?.reminders) : (task?.reminders || [])}
            />

            <CompleteTaskModal
                isOpen={showCompleteModal}
                task={task}
                onClose={() => setShowCompleteModal(false)}
                onSuccess={() => { setShowCompleteModal(false); fetchTaskDetails(); if (onSuccess) onSuccess(); }}
            />
        </div>
    );
};

export default TaskDetailsDrawer;
