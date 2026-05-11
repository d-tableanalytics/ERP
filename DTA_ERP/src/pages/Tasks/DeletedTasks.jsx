import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Trash2, RotateCcw, Search, X, Shield,
    Clock, User, Flag, Filter, ChevronDown,
    ArrowUpDown, RefreshCw, Calendar as CalendarIcon,
    FileUp, Tag, Folder, ListTodo
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import delegationService from '../../services/delegationService';
import taskService from '../../services/taskService';
import teamService from '../../services/teamService';
import MainLayout from '../../components/layout/MainLayout';
import FilterChip from '../../components/tasks/FilterChip';
import { getDateRangeFilter, calculateTaskStatus, taskMatchesStatus } from '../../utils/taskFilters';
import { exportTasksToCSV, formatDate, getStatusBadgeClass } from '../../utils/formatters';

// fmt: short date alias used in the task list JSX
const fmt = (d) => formatDate(d, { day: 'numeric', month: 'short', year: 'numeric' });

// ── Date range helper and FilterChip imported from shared modules ────────────

// ─────────────────────────────────────────────────────────────────────────────

const DeletedTasks = () => {
    const [tasks, setTasks]         = useState([]);
    const [users, setUsers]         = useState([]);
    const [categories, setCategories] = useState([]);
    const [allDepartments, setAllDepartments] = useState([]);
    const [loading, setLoading]     = useState(true);
    const [restoringId, setRestoringId] = useState(null);
    const [confirmTask, setConfirmTask] = useState(null); // task pending restore confirm

    // Filters — same set as MyTasks
    const [search, setSearch]               = useState('');
    const [dateRange, setDateRange]         = useState('All Time');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate]     = useState('');
    const [statusFilter, setStatusFilter]   = useState('All');
    const [priority, setPriority]           = useState('All');
    const [category, setCategory]           = useState('All');
    const [assignedBy, setAssignedBy]       = useState('All');
    const [departmentFilter, setDepartmentFilter] = useState('All');
    const [showFilters, setShowFilters]     = useState(false);

    // Sort
    const [sortBy, setSortBy]       = useState('Deleted At');
    const [sortDesc, setSortDesc]   = useState(true);
    const [expandedTasks, setExpandedTasks] = useState(new Set());

    const filterPanelRef = useRef(null);

    // ADMIN guard — read from Redux (safe) with localStorage fallback
    const authUser = (() => { try { const s = localStorage.getItem('user'); return s ? JSON.parse(s) : {}; } catch { return {}; } })();
    const currentUser  = authUser?.user || authUser;
    const isAdmin      = ['admin', 'superadmin'].includes(currentUser?.role?.toLowerCase());

    useEffect(() => {
        if (isAdmin) fetchAllData();
    }, [isAdmin]);

    // Close filter panel on outside click
    useEffect(() => {
        const handler = (e) => {
            if (filterPanelRef.current && !filterPanelRef.current.contains(e.target)) {
                setShowFilters(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const fetchAllData = async () => {
        try {
            setLoading(true);
            const [deletedRes, usersRes, catRes] = await Promise.all([
                taskService.getDeletedTasks(),
                teamService.getUsers(),
                delegationService.getCategories(),
            ]);
            const fetched = deletedRes || [];
            setTasks(fetched);
            setUsers(Array.isArray(usersRes) ? usersRes : (usersRes.data || []));
            setCategories(catRes.data || catRes || []);

            // Collect unique departments
            const deptSet = new Set();
            fetched.forEach(t => { if (t.department) deptSet.add(t.department); });
            setAllDepartments(Array.from(deptSet).sort());
        } catch (err) {
            console.error(err);
            toast.error('Failed to load deleted tasks');
        } finally {
            setLoading(false);
        }
    };

    const handleClearFilters = () => {
        setSearch(''); setDateRange('All Time');
        setCustomStartDate(''); setCustomEndDate('');
        setStatusFilter('All'); setPriority('All');
        setCategory('All'); setAssignedBy('All'); setDepartmentFilter('All');
    };

    const handleRestore = async (id) => {
        setConfirmTask(null);
        try {
            setRestoringId(id);
            await taskService.restoreTask(id);
            toast.success('Task restored successfully!');
            setTasks(prev => prev.filter(t => t.id !== id));
        } catch {
            toast.error('Failed to restore task');
        } finally {
            setRestoringId(null);
        }
    };

    const openRestoreConfirm = (task) => setConfirmTask(task);
    const closeRestoreConfirm = () => setConfirmTask(null);

    const getStatus = (t) => calculateTaskStatus(t);

    const getUserName = (userId) => {
        const u = users.find(u => u.userId === userId || u.id === userId);
        return u ? `${u.firstName} ${u.lastName}` : 'Unknown';
    };

    // ── Client-side filtering ─────────────────────────────────────────────────

    const filteredTasks = useMemo(() => {
        let result = tasks.filter(t => {
            const q = search.toLowerCase();
            if (q && !t.taskTitle.toLowerCase().includes(q) &&
                !(t.description || '').toLowerCase().includes(q)) return false;

            if (!taskMatchesStatus(t, statusFilter)) return false;
            if (priority !== 'All' && t.priority !== priority) return false;
            if (category !== 'All' && t.category !== category) return false;
            if (assignedBy !== 'All' && t.assignerId !== assignedBy) return false;

            if (departmentFilter !== 'All' && t.department !== departmentFilter) return false;

            return getDateRangeFilter(t.deletedAt || t.createdAt, dateRange, customStartDate, customEndDate);
        });

        // Sort
        result = [...result].sort((a, b) => {
            let va, vb;
            if (sortBy === 'Deleted At') {
                va = new Date(a.deletedAt || 0).getTime();
                vb = new Date(b.deletedAt || 0).getTime();
            } else if (sortBy === 'Due Date') {
                va = a.dueDate ? new Date(a.dueDate).getTime() : 0;
                vb = b.dueDate ? new Date(b.dueDate).getTime() : 0;
            } else if (sortBy === 'Title') {
                va = (a.taskTitle || '').toLowerCase();
                vb = (b.taskTitle || '').toLowerCase();
            } else {
                va = new Date(a.createdAt || 0).getTime();
                vb = new Date(b.createdAt || 0).getTime();
            }
            if (typeof va === 'string') return sortDesc ? vb.localeCompare(va) : va.localeCompare(vb);
            return sortDesc ? vb - va : va - vb;
        });

        return result;
    }, [tasks, search, statusFilter, priority, category, assignedBy, departmentFilter, dateRange, customStartDate, customEndDate, sortBy, sortDesc]);

    const getStatusCount = (st) => {
        if (st === 'All') return tasks.length;
        return tasks.filter(t => taskMatchesStatus(t, st)).length;
    };

    const activeFilterCount = [
        priority !== 'All', category !== 'All', assignedBy !== 'All', departmentFilter !== 'All'
    ].filter(Boolean).length;

    // ── Not-admin guard ───────────────────────────────────────────────────────

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex items-center justify-center">
                <div className="text-center p-12 bg-bg-card rounded-3xl shadow-sm border border-border-main max-w-sm">
                    <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-900/10 flex items-center justify-center mx-auto mb-5">
                        <Shield size={36} className="text-red-400" />
                    </div>
                    <h2 className="text-xl font-black text-text-main mb-2">ADMIN Only</h2>
                    <p className="text-slate-400 text-sm font-medium">
                        You need administrator access to view the deleted tasks bin.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            <MainLayout title="Deleted Tasks">
            <div className="animate-in fade-in duration-500">

            {/* ── Page Title ── */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30">
                        <Trash2 size={22} className="text-white" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-text-main leading-none">Deleted Tasks</h1>
                        <p className="text-xs font-bold text-slate-400 mt-0.5">ADMIN View — Trash Bin</p>
                    </div>
                </div>
                <button
                    onClick={fetchAllData}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm transition shadow-sm active:scale-95"
                >
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            {/* ── Toolbar (same layout as MyTasks) ── */}
            <div className="flex flex-wrap items-end gap-3 mb-6">

                {/* Date Range */}
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date Range</span>
                    <div className="relative min-w-[140px]">
                        <select
                            value={dateRange}
                            onChange={e => setDateRange(e.target.value)}
                            
                            className="w-full h-11 bg-bg-card border border-red-400 dark:border-red-900/50 rounded-lg pl-3 pr-8 text-sm font-bold text-text-main outline-none appearance-none cursor-pointer shadow-sm"
                        >
                            <option value="All Time">All Time</option>
                            <option value="Today">Today</option>
                            <option value="Yesterday">Yesterday</option>
                            <option value="This Week">This Week</option>
                            <option value="Next Week">Next Week</option>
                            <option value="This Month">This Month</option>
                            <option value="Next Month">Next Month</option>
                            <option value="Custom">Custom</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                {/* Custom Date Pickers */}
                {dateRange === 'Custom' && (
                    <>
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase ml-1">Start Date</span>
                            <div className="relative border border-red-400 dark:border-red-900/50 rounded-lg h-11 flex items-center px-2.5 gap-1.5 bg-bg-card min-w-[130px]">
                                <CalendarIcon size={14} className="text-red-500 shrink-0" />
                                <div className="flex flex-col flex-1">
                                    <span className="text-[8px] font-bold text-slate-400 leading-none">Start</span>
                                    <input
                                        type="date"
                                        value={customStartDate}
                                        onChange={e => setCustomStartDate(e.target.value)}
                                        
                                        className="bg-transparent border-none outline-none text-[11px] font-bold text-text-main w-full"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase ml-1">End Date</span>
                            <div className="relative border border-red-400 dark:border-red-900/50 rounded-lg h-11 flex items-center px-2.5 gap-1.5 bg-bg-card min-w-[130px]">
                                <CalendarIcon size={14} className="text-red-500 shrink-0" />
                                <div className="flex flex-col flex-1">
                                    <span className="text-[8px] font-bold text-slate-400 leading-none">End</span>
                                    <input
                                        type="date"
                                        value={customEndDate}
                                        onChange={e => setCustomEndDate(e.target.value)}
                                        
                                        className="bg-transparent border-none outline-none text-[11px] font-bold text-text-main w-full"
                                    />
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Filter button + dropdown (same as MyTasks) */}
                <div className="relative flex flex-col gap-1" ref={filterPanelRef}>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 invisible select-none">_</span>
                    <button
                        onClick={() => setShowFilters(v => !v)}
                        className={`flex items-center gap-2 px-5 h-11 rounded-lg font-bold text-sm transition-all shadow-sm ${
                            showFilters ? 'bg-slate-800 dark:bg-slate-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                        }`}
                    >
                        <Filter size={18} />
                        Filter
                        {activeFilterCount > 0 && (
                            <span className="bg-white text-red-500 text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center border border-white dark:border-slate-700/50 shadow-sm">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>

                    {showFilters && (
                        <div className="absolute top-[calc(100%+8px)] left-0 z-50 bg-bg-card border border-border-main rounded-xl shadow-2xl p-4 flex flex-col gap-4 min-w-[240px] animate-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-text-main uppercase tracking-widest">Filters</span>
                                <button onClick={handleClearFilters} className="text-[10px] font-bold text-red-500 hover:underline">Clear All</button>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Assigned By</label>
                                <select value={assignedBy} onChange={e => setAssignedBy(e.target.value)}  className="bg-bg-main border border-border-main p-2 rounded-lg text-xs font-bold outline-none text-text-main">
                                    <option value="All">Anyone</option>
                                    {users.map(u => <option key={u.userId || u.id} value={u.userId || u.id}>{u.firstName} {u.lastName}</option>)}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Priority</label>
                                <select value={priority} onChange={e => setPriority(e.target.value)}  className="bg-bg-main border border-border-main p-2 rounded-lg text-xs font-bold outline-none text-text-main">
                                    <option value="All">All Priority</option>
                                    <option value="Urgent">Urgent</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Category</label>
                                <select value={category} onChange={e => setCategory(e.target.value)}  className="bg-bg-main border border-border-main p-2 rounded-lg text-xs font-bold outline-none text-text-main">
                                    <option value="All">All Categories</option>
                                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Department</label>
                                <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)}  className="bg-bg-main border border-border-main p-2 rounded-lg text-xs font-bold outline-none text-text-main">
                                    <option value="All">All Departments</option>
                                    {allDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Search */}
                <div className="relative flex-1 max-w-sm flex flex-col gap-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 invisible select-none">_</span>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search deleted tasks..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full h-11 pl-10 pr-10 bg-bg-card border border-border-main rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-red-400/20 focus:border-red-300 text-text-main"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                                <X size={14} strokeWidth={3} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Clear all */}
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 invisible select-none">_</span>
                    <button
                        onClick={handleClearFilters}
                        title="Clear Filters"
                        className="h-11 w-11 flex items-center justify-center bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-sm active:scale-95"
                    >
                        <RotateCcw size={18} strokeWidth={3} />
                    </button>
                </div>

                {/* Sort */}
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 invisible select-none">_</span>
                    <div className="flex items-center gap-2">
                        <div className="relative min-w-[140px]">
                            <select
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value)}
                                
                                className="w-full h-11 bg-bg-card border border-border-main rounded-lg pl-3 pr-8 text-sm font-bold text-text-main outline-none appearance-none cursor-pointer shadow-sm focus:border-red-400"
                            >
                                <option value="Deleted At">Deleted At</option>
                                <option value="Due Date">Due Date</option>
                                <option value="Created At">Created At</option>
                                <option value="Title">Title</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                        <button
                            onClick={() => setSortDesc(!sortDesc)}
                            className="h-11 w-11 flex justify-center items-center bg-bg-card border border-border-main rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors shadow-sm active:scale-95"
                            title={sortDesc ? 'Descending' : 'Ascending'}
                        >
                            <ArrowUpDown size={18} className={sortDesc ? '' : 'rotate-180 transform transition-transform'} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Active filter chips ── */}
            {activeFilterCount > 0 && (
                <div className="flex flex-wrap gap-2 mb-4 animate-in slide-in-from-top-2 duration-200">
                    {priority !== 'All' && <FilterChip label={`Priority: ${priority}`} onRemove={() => setPriority('All')} />}
                    {category !== 'All' && <FilterChip label={`Category: ${category}`} onRemove={() => setCategory('All')} />}
                    {assignedBy !== 'All' && <FilterChip label={`Assigned By: ${getUserName(assignedBy)}`} onRemove={() => setAssignedBy('All')} />}
                    {departmentFilter !== 'All' && <FilterChip label={`Department: ${departmentFilter}`} onRemove={() => setDepartmentFilter('All')} />}
                </div>
            )}

            {/* ── Status Tabs ── */}
            <div className="flex justify-center mb-8 border-b border-border-main relative">
                <div className="flex gap-6 overflow-x-auto no-scrollbar">
                    {[
                        { label: 'All',         dotClass: 'bg-slate-400',                              key: 'All' },
                        { label: 'Overdue',     dotClass: 'bg-red-500',                                key: 'Overdue' },
                        { label: 'Pending',     dotClass: 'border-2 border-slate-400 bg-transparent',  key: 'Pending' },
                        { label: 'In Progress', dotClass: 'bg-orange-500',                             key: 'In Progress' },
                        { label: 'Completed',   dotClass: 'bg-emerald-500',                            key: 'Completed' },
                        { label: 'Hold',        dotClass: 'bg-amber-500',                              key: 'Hold' },
                        { label: 'Revision',    dotClass: 'bg-indigo-500',                             key: 'Need Revision' },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setStatusFilter(tab.key)}
                            className={`flex items-center gap-2 pb-4 px-2 transition-all relative whitespace-nowrap ${statusFilter === tab.key ? 'text-text-main' : 'text-text-muted hover:text-text-main'}`}
                        >
                            <div className={`w-3 h-3 rounded-full shrink-0 ${tab.dotClass} ${statusFilter === tab.key ? 'ring-2 ring-red-500/20 shadow-sm' : ''}`} />
                            <span className="text-sm font-bold uppercase tracking-wide">
                                {tab.label} — <span className={`${statusFilter === tab.key ? 'text-red-500 dark:text-red-400 font-black' : 'text-text-muted font-bold'} transition-colors`}>{getStatusCount(tab.key)}</span>
                            </span>
                            {statusFilter === tab.key && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-500 rounded-t-full shadow-[0_-2px_10px_rgba(239,68,68,0.3)]" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Task List ── */}
            <div className="space-y-3 pb-20">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-12 h-12 border-4 border-red-400 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Loading Deleted Tasks...</p>
                    </div>
                ) : filteredTasks.length === 0 ? (
                    <div className="bg-bg-card border-2 border-dashed border-border-main rounded-3xl p-20 flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 bg-bg-main rounded-full flex items-center justify-center mb-5">
                            <Trash2 size={32} className="text-slate-300 dark:text-slate-600" />
                        </div>
                        <h3 className="text-lg font-black text-text-main">Trash Is Empty</h3>
                        <p className="text-slate-400 text-sm font-medium mt-1">
                            {search || activeFilterCount > 0 || statusFilter !== 'All'
                                ? 'No deleted tasks match your filters'
                                : 'No deleted tasks found'}
                        </p>
                        {(activeFilterCount > 0 || statusFilter !== 'All') && (
                            <button
                                onClick={handleClearFilters}
                                className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 transition-all active:scale-95 shadow-sm"
                            >
                                Clear Filters
                            </button>
                        )}
                    </div>
                ) : (
                    filteredTasks.map(task => {
                        const st = getStatus(task);
                        
                        return (
                            <div key={task.id} className={`bg-bg-card rounded-xl border border-border-main premium-shadow premium-shadow-hover transition-all duration-300 p-5 flex items-start gap-5 ${expandedTasks.has(task.id) ? 'ring-2 ring-red-500/20 shadow-md' : ''}`}>

                                {/* Avatar */}
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center text-white font-black text-sm shrink-0 shadow">
                                    {(task.doerFirstName?.[0] || 'U')}{(task.doerLastName?.[0] || '')}
                                </div>

                                {/* Body */}
                                <div className="flex-1 min-w-0">
                                    {/* Top row */}
                                    <div className="flex items-center gap-3 flex-wrap mb-1">
                                        <span className="font-black text-text-main text-sm">
                                            {task.doerFirstName} {task.doerLastName}
                                        </span>
                                        {task.category && (
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{task.category}</span>
                                        )}
                                        <span className="text-[11px] font-bold text-red-400 ml-auto whitespace-nowrap">
                                            Deleted {fmt(task.deletedAt)}
                                        </span>
                                    </div>

                                    {/* Title */}
                                    <h3 className="text-base font-black text-text-main truncate mb-2">{task.taskTitle}</h3>

                                    {/* Meta */}
                                    <div className="flex flex-wrap items-center gap-3 text-xs">
                                        <span className="text-slate-400 font-semibold">
                                            Assigned By <span className="font-black text-text-main">{task.assignerFirstName} {task.assignerLastName}</span>
                                        </span>

                                        {task.dueDate && (
                                            <span className={`flex items-center gap-1.5 font-bold ${st === 'Overdue' ? 'text-red-500' : 'text-text-muted'}`}>
                                                <Clock size={12} />
                                                {fmt(task.dueDate)}
                                                {st === 'Overdue' && ' | Overdue'}
                                            </span>
                                        )}

                                        <span className={getStatusBadgeClass(st)}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${st === 'Completed' ? 'bg-emerald-500' : st === 'In Progress' ? 'bg-orange-500' : st === 'Overdue' ? 'bg-red-500' : 'bg-slate-400'}`} />
                                            {st}
                                        </span>

                                        {task.priority && (
                                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border font-bold text-[11px] ${task.priority === 'Urgent' ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/10 dark:text-red-400 dark:border-red-800' : task.priority === 'High' ? 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/10 dark:text-orange-400 dark:border-orange-800' : task.priority === 'Medium' ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-800' : 'bg-bg-main text-text-muted border-border-main'}`}>
                                                <Flag size={10} strokeWidth={3} />
                                                {task.priority}
                                            </span>
                                        )}

                                        {(task.deletedByFirstName || task.deletedByLastName) && (
                                            <span className="flex items-center gap-1 text-slate-400 font-semibold">
                                                <Trash2 size={11} className="text-red-400" />
                                                Deleted by {task.deletedByFirstName} {task.deletedByLastName}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Restore */}
                                <button
                                    onClick={() => openRestoreConfirm(task)}
                                    disabled={restoringId === task.id}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-border-main hover:border-[#137fec] text-text-muted hover:text-[#137fec] dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 font-bold text-sm transition-all active:scale-95 disabled:opacity-50 shrink-0"
                                >
                                    {restoringId === task.id ? (
                                        <span className="w-4 h-4 border-2 border-[#137fec] border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <RotateCcw size={16} />
                                    )}
                                    Restore
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
            </div>
        </MainLayout>

        {/* ── Restore Confirmation Modal ── */}
        {confirmTask && (
            <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" onClick={closeRestoreConfirm}>
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" />

                {/* Modal */}
                <div
                    className="relative bg-bg-card rounded-2xl shadow-2xl border border-border-main w-full max-w-sm p-6 animate-in zoom-in-95 duration-200"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Icon */}
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-4">
                        <RotateCcw size={26} className="text-emerald-500" strokeWidth={2.5} />
                    </div>

                    {/* Heading */}
                    <h3 className="text-lg font-black text-text-main text-center mb-1">Restore Task?</h3>
                    <p className="text-sm font-medium text-slate-500 text-center mb-1">
                        <span className="font-bold text-text-main">&ldquo;{confirmTask.taskTitle}&rdquo;</span>
                    </p>
                    <p className="text-xs text-slate-400 text-center mb-6">It will become active again and visible to all assignees.</p>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={closeRestoreConfirm}
                            className="flex-1 h-11 rounded-xl border-2 border-border-main text-text-muted font-bold text-sm hover:border-slate-300 hover:text-text-main transition-all active:scale-95"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => handleRestore(confirmTask.id)}
                            disabled={restoringId === confirmTask.id}
                            className="flex-1 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60 shadow-lg shadow-emerald-500/20"
                        >
                            {restoringId === confirmTask.id ? (
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <RotateCcw size={15} strokeWidth={2.5} />
                            )}
                            Restore
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default DeletedTasks;


