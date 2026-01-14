import React from 'react';
import { useNavigate } from 'react-router-dom';

const DelegationCard = ({ delegation, user, isAdmin, onEdit, onDelete }) => {
    const navigate = useNavigate();

    // Helper to format date
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString('en-IN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: false
        });
    };

    const isOverdue = new Date(delegation.due_date) < new Date() && delegation.status !== 'COMPLETED';

    return (
        <div className="bg-[#1e293b] rounded-xl overflow-hidden shadow-lg border border-slate-700/50 group hover:border-slate-600 transition-all font-sans">
            {/* Header Section */}
            <div className="p-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="size-12 bg-yellow-400 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-yellow-400/20">
                        <span className="material-symbols-outlined text-black text-2xl">assignment</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                            <span className="text-slate-500 font-bold text-xs">#{delegation.id}</span>
                            {isOverdue && (
                                <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Overdue</span>
                            )}
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${delegation.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' :
                                delegation.status === 'NEED CLARITY' ? 'bg-amber-500/20 text-amber-400' :
                                    delegation.status === 'APPROVAL WAITING' ? 'bg-blue-500/20 text-blue-400' :
                                        'bg-slate-500/20 text-slate-400'
                                }`}>
                                {delegation.status}
                            </span>
                        </div>
                        <h3 className="text-white font-bold text-lg mb-1 truncate leading-tight" title={delegation.delegation_name}>{delegation.delegation_name}</h3>
                        <p className="text-slate-400 text-sm line-clamp-1">{delegation.description || 'No description provided.'}</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0">
                    <button onClick={() => navigate(`/delegation/${delegation.id}`)} className="text-slate-400 hover:text-yellow-400 transition-colors p-1">
                        <span className="material-symbols-outlined text-xl">visibility</span>
                    </button>
                    {(isAdmin || delegation.delegator_id === user.id) && (
                        <>
                            <button onClick={() => onEdit(delegation)} className="text-slate-400 hover:text-blue-400 transition-colors p-1">
                                <span className="material-symbols-outlined text-xl">edit</span>
                            </button>
                            <button onClick={() => onDelete(delegation.id)} className="text-slate-400 hover:text-red-400 transition-colors p-1">
                                <span className="material-symbols-outlined text-xl">delete</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Info Blocks - Grid of 4 */}
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                {/* Assignee */}
                <div className="bg-[#2563eb] rounded-lg p-3 flex items-center gap-3 shadow-lg shadow-blue-900/20">
                    <div className="size-8 rounded bg-white/20 flex items-center justify-center text-white">
                        <span className="material-symbols-outlined text-lg">person</span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold text-blue-200 uppercase tracking-wide">Assignee</p>
                        <p className="text-white font-bold text-sm truncate">{delegation.delegator_name}</p>
                    </div>
                </div>

                {/* Doer */}
                <div className="bg-[#9333ea] rounded-lg p-3 flex items-center gap-3 shadow-lg shadow-purple-900/20">
                    <div className="size-8 rounded bg-white/20 flex items-center justify-center text-white">
                        <span className="material-symbols-outlined text-lg">group</span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold text-purple-200 uppercase tracking-wide">Doer</p>
                        <p className="text-white font-bold text-sm truncate">{delegation.doer_name}</p>
                    </div>
                </div>

                {/* Department */}
                <div className="bg-[#10b981] rounded-lg p-3 flex items-center gap-3 shadow-lg shadow-emerald-900/20">
                    <div className="size-8 rounded bg-white/20 flex items-center justify-center text-white">
                        <span className="material-symbols-outlined text-lg">domain</span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-wide">Department</p>
                        <p className="text-white font-bold text-sm truncate">{delegation.department}</p>
                    </div>
                </div>

                {/* Priority */}
                <div className="bg-[#ef4444] rounded-lg p-3 flex items-center gap-3 shadow-lg shadow-red-900/20">
                    <div className="size-8 rounded bg-white/20 flex items-center justify-center text-white">
                        <span className="material-symbols-outlined text-lg">warning</span>
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold text-red-200 uppercase tracking-wide">Priority</p>
                        <p className="text-white font-bold text-sm capitalize">{delegation.priority}</p>
                    </div>
                </div>
            </div>

            {/* Footer Status Bar */}
            <div className="bg-slate-800/50 px-4 py-3 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-medium border-t border-slate-700/50">
                <div className="flex items-center gap-6 w-full md:w-auto">
                    <div className="flex items-center gap-2 text-slate-300">
                        <div className="bg-slate-700 p-1 rounded">
                            <span className="material-symbols-outlined text-base">event</span>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">Due Date</p>
                            <p>{formatDate(delegation.due_date)}</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                    <div className="flex items-center gap-2">
                        <div className={`p-1 rounded ${delegation.evidence_required ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-700 text-slate-500'}`}>
                            <span className="material-symbols-outlined text-base">{delegation.evidence_required ? 'check_circle' : 'cancel'}</span>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">Evidence</p>
                            <p className={delegation.evidence_required ? 'text-emerald-400' : 'text-slate-400'}>
                                {delegation.evidence_required ? 'Required' : 'Optional'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-slate-400">
                        <div className="bg-slate-700 p-1 rounded">
                            <span className="material-symbols-outlined text-base">schedule</span>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-slate-500 font-bold uppercase">Created</p>
                            <p>{new Date(delegation.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DelegationCard;
