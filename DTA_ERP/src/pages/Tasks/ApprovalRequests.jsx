import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { CheckCircle, XCircle, Clock, LayoutGrid, CheckSquare, MoreVertical, Search, RotateCcw } from 'lucide-react';
import taskService from '../../services/taskService';
import MainLayout from '../../components/layout/MainLayout';
import TaskDetailsDrawer from '../../components/delegation/TaskDetailsDrawer';
import { getStatusBadgeClass, formatTimeAgo } from '../../utils/formatters';

const ApprovalRequests = () => {
    const [activeTab, setActiveTab] = useState('PENDING'); // PENDING, APPROVED, REJECTED
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    
    // Details Drawer
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    
    // Reject Modal
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectingTaskId, setRejectingTaskId] = useState(null);
    const [rejectRemark, setRejectRemark] = useState('');
    
    // Processing States
    const [processingId, setProcessingId] = useState(null);
    const [isRejecting, setIsRejecting] = useState(false);

    const [counts, setCounts] = useState({ PENDING: 0, APPROVED: 0, REJECTED: 0 });

    const fetchTasks = useCallback(async () => {
        setLoading(true);
        try {
            const [pendingData, approvedData, rejectedData] = await Promise.all([
                taskService.getPendingApprovals(),
                taskService.getApprovedTasks(),
                taskService.getRejectedTasks()
            ]);

            setCounts({
                PENDING: pendingData?.length || 0,
                APPROVED: approvedData?.length || 0,
                REJECTED: rejectedData?.length || 0
            });

            if (activeTab === 'PENDING') setTasks(pendingData || []);
            else if (activeTab === 'APPROVED') setTasks(approvedData || []);
            else if (activeTab === 'REJECTED') setTasks(rejectedData || []);
        } catch (error) {
            console.error('Error fetching approval tasks:', error);
            toast.error('Failed to load tasks');
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    const handleApprove = async (task, e) => {
        if (e) e.stopPropagation();
        
        if (task.status !== 'Completed') {
            toast.error('Only Completed tasks can be approved!');
            return;
        }

        setProcessingId(task.id);
        try {
            await taskService.approveTask(task.id);
            toast.success('Task approved successfully');
            await fetchTasks();
        } catch (error) {
            console.error('Approval error:', error);
            toast.error('Failed to approve task');
        } finally {
            setProcessingId(null);
        }
    };

    const handleRejectClick = (task, e) => {
        if (e) e.stopPropagation();
        
        if (task.status !== 'Completed') {
            toast.error('Only Completed tasks can be rejected!');
            return;
        }

        setRejectingTaskId(task.id);
        setRejectRemark('');
        setShowRejectModal(true);
    };

    const submitReject = async () => {
        if (!rejectRemark.trim()) {
            toast.error('Please provide a reason for rejection');
            return;
        }
        setIsRejecting(true);
        try {
            await taskService.rejectTask(rejectingTaskId, rejectRemark);
            toast.success('Task rejected');
            setShowRejectModal(false);
            await fetchTasks();
        } catch (error) {
            console.error('Rejection error:', error);
            toast.error('Failed to reject task');
        } finally {
            setIsRejecting(false);
        }
    };

    const filteredTasks = tasks.filter(t => {
        if (search && !(t.taskTitle || '').toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    return (
        <MainLayout title="Approval Requests">
            <div className="animate-in fade-in duration-500">
                
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <CheckCircle size={22} className="text-white" strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-text-main leading-none">Approval Requests</h1>
                            <p className="text-xs font-bold text-slate-400 mt-0.5">Manage task completions</p>
                        </div>
                    </div>
                </div>

                {/* Search & Tabs */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
                    <div className="flex bg-bg-card rounded-xl p-1.5 shadow-sm border border-border-main w-full sm:w-auto">
                        {[
                            { id: 'PENDING', label: 'Pending', icon: Clock },
                            { id: 'APPROVED', label: 'Approved', icon: CheckCircle },
                            { id: 'REJECTED', label: 'Rejected', icon: XCircle }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' : 'text-slate-500 hover:text-text-main hover:bg-bg-main'}`}
                            >
                                <tab.icon size={16} />
                                {tab.label}
                                <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-black ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                    {counts[tab.id]}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full sm:w-72 flex items-center">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search tasks..." 
                            value={search} 
                            onChange={e => setSearch(e.target.value)} 
                            className="w-full h-11 pl-10 pr-4 bg-bg-card border border-border-main rounded-lg text-sm font-bold text-text-main outline-none focus:ring-2 focus:ring-indigo-500/20" 
                        />
                    </div>
                </div>

                {/* List */}
                <div className="max-w-7xl mx-auto space-y-3 pb-20">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Loading Requests...</p>
                        </div>
                    ) : filteredTasks.length === 0 ? (
                        <div className="bg-white/40 border-2 border-dashed border-border-main rounded-3xl p-20 flex flex-col items-center justify-center text-center">
                            <div className="w-20 h-20 bg-bg-main rounded-full flex items-center justify-center mb-6"><CheckSquare size={40} className="text-slate-300" /></div>
                            <h3 className="text-xl font-black text-text-main mb-2">No Requests Found</h3>
                            <p className="text-slate-500 font-medium">There are no {activeTab.toLowerCase()} tasks right now.</p>
                        </div>
                    ) : (
                        filteredTasks.map(task => (
                            <div key={task.id} className="group relative bg-bg-card rounded-2xl border border-border-main hover:border-indigo-500/30 p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 cursor-pointer shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300" onClick={() => { setSelectedTaskId(task.id); setShowDetails(true); }}>
                                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 rounded-l-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                
                                <div className="flex items-start gap-4 flex-1 min-w-0">
                                    <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold relative shrink-0 shadow-md">
                                        <div className="absolute inset-0 rounded-2xl border border-white/20" />
                                        {`${task.doerFirstName?.[0] || ''}${task.doerLastName?.[0] || ''}`.toUpperCase() || '?'}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-lg font-black text-text-main truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{task.taskTitle}</span>
                                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-xs font-bold flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                {task.doerFirstName} {task.doerLastName}
                                            </span>
                                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                                                <Clock size={10} />
                                                {formatTimeAgo(task.completedAt || task.createdAt)}
                                            </span>
                                            
                                            {/* Action Tracking Info */}
                                            {activeTab !== 'PENDING' && task.actionedByName && (
                                                <>
                                                    <span className="text-slate-300 dark:text-slate-600 mx-0.5">•</span>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                                                        activeTab === 'APPROVED' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                                                    }`}>
                                                        {activeTab === 'APPROVED' ? <CheckCircle size={10} /> : <XCircle size={10} />}
                                                        {activeTab === 'APPROVED' ? 'Approved By:' : 'Rejected By:'} <span className="font-bold underline decoration-dotted underline-offset-2">{task.actionedByName}</span>
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-end gap-3 shrink-0 pt-4 border-t border-border-main md:border-t-0 md:pt-0">
                                    <div className="hidden md:block scale-90">
                                        <span className={getStatusBadgeClass(task.status)}>{task.status}</span>
                                    </div>
                                    
                                    {activeTab === 'PENDING' && (
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={(e) => handleApprove(task, e)} 
                                                disabled={processingId === task.id}
                                                className="flex items-center justify-center min-w-[90px] h-9 px-4 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm"
                                            >
                                                {processingId === task.id ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : 'Approve'}
                                            </button>
                                            <button 
                                                onClick={(e) => handleRejectClick(task, e)} 
                                                disabled={processingId === task.id}
                                                className="flex items-center justify-center min-w-[90px] h-9 px-4 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    )}

                                    <button onClick={(e) => { e.stopPropagation(); setSelectedTaskId(task.id); setShowDetails(true); }} className="w-9 h-9 flex items-center justify-center bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-900/30 rounded-xl text-slate-400 hover:text-indigo-500 transition-all border border-border-main group-hover:border-indigo-200 dark:group-hover:border-indigo-800">
                                        <MoreVertical size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <TaskDetailsDrawer isOpen={showDetails} taskId={selectedTaskId} onClose={() => setShowDetails(false)} onSuccess={fetchTasks} />
                
                {/* Reject Modal */}
                {showRejectModal && (
                    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-in fade-in">
                        <div className="bg-bg-card border border-white dark:border-slate-800 rounded-2xl w-full max-w-md p-6 relative shadow-xl">
                            <h2 className="text-lg font-black text-text-main mb-2">Reject Task</h2>
                            <p className="text-sm font-medium text-text-muted mb-4">Please provide a reason for rejecting this task completion. The task status will be reverted to Pending.</p>
                            
                            <textarea 
                                value={rejectRemark}
                                onChange={e => setRejectRemark(e.target.value)}
                                placeholder="Enter rejection reason..."
                                className="w-full h-24 p-3 bg-bg-main border border-border-main rounded-xl text-sm font-medium outline-none focus:border-red-500 resize-none mb-4"
                            />

                            <div className="flex justify-end gap-3">
                                <button onClick={() => setShowRejectModal(false)} className="px-5 py-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl font-bold text-sm transition-all" disabled={isRejecting}>Cancel</button>
                                <button onClick={submitReject} disabled={isRejecting} className="flex items-center justify-center min-w-[120px] px-5 py-2.5 bg-red-500 text-white hover:bg-red-600 disabled:opacity-70 disabled:cursor-not-allowed rounded-xl font-bold text-sm transition-all shadow-lg shadow-red-500/20">
                                    {isRejecting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Reject Task'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                
            </div>
        </MainLayout>
    );
};

export default ApprovalRequests;
