import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import MainLayout from '../../components/layout/MainLayout';
import CreateDelegationModal from '../../components/delegation/CreateDelegationModal';

const Delegation = () => {
    const { token, user } = useSelector((state) => state.auth);
    const [delegations, setDelegations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const getStatCount = (label) => {
        return delegations.filter(d => d.status === label).length;
    };

    const stats = [
        { label: 'NEED CLARITY', count: getStatCount('NEED CLARITY'), color: 'text-amber-500', bgColor: 'bg-amber-100', icon: 'help_outline' },
        { label: 'APPROVAL WAITING', count: getStatCount('APPROVAL WAITING'), color: 'text-blue-500', bgColor: 'bg-blue-100', icon: 'schedule' },
        { label: 'COMPLETED', count: getStatCount('COMPLETED'), color: 'text-emerald-500', bgColor: 'bg-emerald-100', icon: 'check_circle' },
        { label: 'NEED REVISION', count: getStatCount('NEED REVISION'), color: 'text-orange-500', bgColor: 'bg-orange-100', icon: 'history' },
        { label: 'HOLD', count: getStatCount('HOLD'), color: 'text-slate-500', bgColor: 'bg-slate-100', icon: 'pause_circle' },
    ];

    useEffect(() => {
        fetchDelegations();
    }, []);

    const fetchDelegations = async () => {
        try {
            const response = await axios.get('http://localhost:5000/api/delegations', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDelegations(response.data);
            setIsLoading(false);
        } catch (error) {
            console.error('Error fetching delegations:', error);
            setIsLoading(false);
        }
    };

    const [showFilters, setShowFilters] = useState(false);
    const isAdmin = user?.role === 'Admin' || user?.role === 'SuperAdmin';

    return (
        <MainLayout title="Delegations">
            <div className="flex flex-col gap-5 p-2 md:p-4">
                {/* Header Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-text-main flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">assignment_turned_in</span>
                            Delegations
                        </h1>
                        <p className="text-xs md:text-sm text-text-muted">Track and manage task assignments efficiently</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-2.5 rounded-xl border border-border-main transition-all flex items-center gap-2 text-sm font-semibold ${showFilters ? 'bg-primary text-white border-primary' : 'text-text-main bg-bg-card hover:bg-bg-main'}`}
                        >
                            <span className="material-symbols-outlined text-[20px]">filter_alt</span>
                            {showFilters ? 'Hide Filters' : 'Filters'}
                        </button>

                        {isAdmin && (
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-primary/20 flex items-center gap-2 text-sm"
                            >
                                <span className="material-symbols-outlined text-[20px]">add</span>
                                <span className="hidden sm:inline">New Delegation</span>
                                <span className="sm:hidden">New</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Compact Stats Row */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    {stats.map((stat, idx) => (
                        <div key={idx} className="bg-bg-card border border-border-main rounded-xl p-3 flex items-center gap-3 hover:border-primary/30 transition-all shadow-sm">
                            <div className={`${stat.bgColor} ${stat.color} size-10 rounded-lg flex items-center justify-center shrink-0`}>
                                <span className="material-symbols-outlined text-[22px]">{stat.icon}</span>
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted truncate">{stat.label}</p>
                                <p className="text-lg font-bold text-text-main">{stat.count}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Collapsible Filter Panel */}
                {showFilters && (
                    <div className="bg-bg-card border border-border-main rounded-xl p-4 md:p-5 animate-in slide-in-from-top-4 duration-300">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-text-muted uppercase px-1">Search Task</label>
                                <input type="text" placeholder="By name, ID..." className="w-full bg-bg-main border border-border-main rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-text-muted uppercase px-1">Department</label>
                                <select className="w-full bg-bg-main border border-border-main rounded-xl px-3 py-2 text-sm outline-none">
                                    <option>All Departments</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-text-muted uppercase px-1">Status</label>
                                <select className="w-full bg-bg-main border border-border-main rounded-xl px-3 py-2 text-sm outline-none">
                                    <option>All Statuses</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-text-muted uppercase px-1">Priority</label>
                                <select className="w-full bg-bg-main border border-border-main rounded-xl px-3 py-2 text-sm outline-none">
                                    <option>All Priorities</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {/* Data Table */}
                <div className="bg-bg-card border border-border-main rounded-2xl overflow-hidden shadow-md">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-sm text-left border-collapse min-w-[1000px] lg:min-w-full">
                            <thead>
                                <tr className="bg-bg-main/40 text-text-muted font-bold uppercase tracking-wider text-[10px] border-b border-border-main">
                                    <th className="px-5 py-4">ID</th>
                                    <th className="px-5 py-4">Task Details</th>
                                    <th className="px-5 py-4">Assignee & Doer</th>
                                    <th className="px-5 py-4">Dept & Priority</th>
                                    <th className="px-5 py-4">Deadline</th>
                                    <th className="px-5 py-4">Status</th>
                                    <th className="px-5 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-main">
                                {isLoading ? (
                                    <tr><td colSpan="7" className="px-6 py-12 text-center text-text-muted">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                            <span>Loading delegations...</span>
                                        </div>
                                    </td></tr>
                                ) : delegations.length === 0 ? (
                                    <tr><td colSpan="7" className="px-6 py-20 text-center text-text-muted">
                                        <span className="material-symbols-outlined text-4xl mb-2 opacity-20">inventory_2</span>
                                        <p className="italic">No delegations found matching your roles/filters.</p>
                                    </td></tr>
                                ) : (
                                    delegations.map((del) => (
                                        <tr key={del.id} className="hover:bg-bg-main/20 transition-colors group">
                                            <td className="px-5 py-4 font-bold text-text-main text-xs">#{del.id}</td>
                                            <td className="px-5 py-4">
                                                <div className="max-w-[200px] md:max-w-xs">
                                                    <p className="font-bold text-text-main truncate" title={del.delegation_name}>{del.delegation_name}</p>
                                                    <p className="text-[11px] text-text-muted line-clamp-1">{del.description || 'No description'}</p>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] uppercase">
                                                            {del.delegator_name?.charAt(0)}
                                                        </div>
                                                        <span className="text-xs font-medium text-text-main line-clamp-1">By: {del.delegator_name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="size-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-[10px] uppercase">
                                                            {del.doer_name?.charAt(0)}
                                                        </div>
                                                        <span className="text-xs font-medium text-text-main line-clamp-1">To: {del.doer_name}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="space-y-1">
                                                    <p className="text-xs font-semibold text-text-main">{del.department}</p>
                                                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${del.priority === 'high' ? 'bg-red-50 text-red-600 border border-red-100' :
                                                            del.priority === 'medium' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                                'bg-slate-50 text-slate-600 border border-slate-100'
                                                        }`}>
                                                        {del.priority}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="text-[11px]">
                                                    <p className="font-bold text-text-main">{new Date(del.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                                                    <p className="text-text-muted">{new Date(del.due_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${del.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                                                        del.status === 'NEED CLARITY' ? 'bg-amber-100 text-amber-700' :
                                                            del.status === 'APPROVAL WAITING' ? 'bg-blue-100 text-blue-700' :
                                                                'bg-slate-100 text-slate-700'
                                                    }`}>
                                                    {del.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <button className="p-2 rounded-lg hover:bg-bg-main text-primary transition-colors inline-flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-[20px]">visibility</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <CreateDelegationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchDelegations}
            />
        </MainLayout>
    );
};

export default Delegation;
