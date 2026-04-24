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

// ── helpers ──────────────────────────────────────────────────────────────────

const getDateRangeFilter = (taskDate, range, customStart, customEnd) => {
    if (!taskDate) return false;
    const d = new Date(taskDate);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (range) {
        case 'Today': return d >= today;
        case 'Yesterday': {
            const y = new Date(today); y.setDate(y.getDate() - 1);
            return d >= y && d < today;
        }
        case 'This Week': {
            const s = new Date(today);
            s.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
            return d >= s;
        }
        case 'Next Week': {
            const s = new Date(today);
            s.setDate(today.getDate() - today.getDay() + 7);
            const e = new Date(s); e.setDate(s.getDate() + 6);
            return d >= s && d <= e;
        }
        case 'This Month': return d >= new Date(now.getFullYear(), now.getMonth(), 1);
        case 'Next Month': {
            const s = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const e = new Date(now.getFullYear(), now.getMonth() + 2, 0);
            return d >= s && d <= e;
        }
        case 'Custom': {
            if (!customStart || !customEnd) return true;
            return d >= new Date(customStart) && d <= new Date(customEnd + 'T23:59:59');
        }
        default: return true; // All Time
    }
};

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// ── FilterChip ───────────────────────────────────────────────────────────────

const FilterChip = ({ label, onRemove }) => (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-800 border border-[#137fec]/40 dark:border-[#137fec]/20 text-[#137fec] rounded-full text-[11px] font-bold">
        {label}
        <button onClick={onRemove} className="hover:text-red-500 transition-colors ml-0.5">
            <X size={12} strokeWidth={3} />
        </button>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────

const DeletedTasks = () => {
    const [tasks, setTasks]         = useState([]);
    const [users, setUsers]         = useState([]);
    const [categories, setCategories] = useState([]);
    const [allTags, setAllTags]     = useState([]);
    const [loading, setLoading]     = useState(true);
    const [restoringId, setRestoringId] = useState(null);

    // Filters — same set as MyTasks
    const [search, setSearch]               = useState('');
    const [dateRange, setDateRange]         = useState('All Time');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate]     = useState('');
    const [statusFilter, setStatusFilter]   = useState('All');
    const [priority, setPriority]           = useState('All');
    const [category, setCategory]           = useState('All');
    const [assignedBy, setAssignedBy]       = useState('All');
    const [tagFilter, setTagFilter]         = useState('All');
    const [showFilters, setShowFilters]     = useState(false);

    // Sort
    const [sortBy, setSortBy]       = useState('Deleted At');
    const [sortDesc, setSortDesc]   = useState(true);
    const [expandedTasks, setExpandedTasks] = useState(new Set());

    const filterPanelRef = useRef(null);

    // ADMIN guard
    const storedUser   = JSON.parse(localStorage.getItem('user') || '{}');
    const currentUser  = storedUser?.user || storedUser;
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

            // Collect unique tags
            const tagSet = new Set();
            fetched.forEach(t => {
                try {
                    const parsed = typeof t.tags === 'string' ? JSON.parse(t.tags) : (t.tags || []);
                    if (Array.isArray(parsed)) parsed.forEach(tag => tag?.text && tagSet.add(tag.text));
                } catch (e) {}
            });
            setAllTags(Array.from(tagSet));
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
        setCategory('All'); setAssignedBy('All'); setTagFilter('All');
    };

    const handleRestore = async (id) => {
        if (!window.confirm('Restore this task? It will become active again.')) return;
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

    const isOverdue = (t) => t.status !== 'Completed' && t.dueDate && new Date(t.dueDate) < new Date();
    const getStatus = (t) => isOverdue(t) ? 'OverDue' : t.status;

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

            const st = getStatus(t);
            if (statusFilter !== 'All' && st !== statusFilter) return false;
            if (priority !== 'All' && t.priority !== priority) return false;
            if (category !== 'All' && t.category !== category) return false;
            if (assignedBy !== 'All' && t.assignerId !== assignedBy) return false;

            if (tagFilter !== 'All') {
                try {
                    const taskTags = typeof t.tags === 'string' ? JSON.parse(t.tags) : (t.tags || []);
                    if (!taskTags.some(tag => tag?.text === tagFilter)) return false;
                } catch { return false; }
            }

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
    }, [tasks, search, statusFilter, priority, category, assignedBy, tagFilter, dateRange, customStartDate, customEndDate, sortBy, sortDesc]);

    const getStatusCount = (st) => {
        if (st === 'All') return tasks.length;
        return tasks.filter(t => getStatus(t) === st).length;
    };

    const activeFilterCount = [
        priority !== 'All', category !== 'All', assignedBy !== 'All', tagFilter !== 'All'
    ].filter(Boolean).length;

    // ── Not-admin guard ───────────────────────────────────────────────────────

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 flex items-center justify-center">
                <div className="text-center p-12 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 max-w-sm">
                    <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-900/10 flex items-center justify-center mx-auto mb-5">
                        <Shield size={36} className="text-red-400" />
                    </div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">ADMIN Only</h2>
                    <p className="text-slate-400 text-sm font-medium">
                        You need administrator access to view the deleted tasks bin.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <MainLayout title="Deleted Tasks">
            <div className="animate-in fade-in duration-500">

            {/* ── Page Title ── */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30">
                        <Trash2 size={22} className="text-white" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-none">Deleted Tasks</h1>
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
                            style={{ colorScheme: 'dark' }}
                            className="w-full h-11 bg-white dark:bg-slate-900 border border-red-400 dark:border-red-900/50 rounded-lg pl-3 pr-8 text-sm font-bold text-slate-700 dark:text-slate-100 outline-none appearance-none cursor-pointer shadow-sm"
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
                            <div className="relative border border-red-400 dark:border-red-900/50 rounded-lg h-11 flex items-center px-2.5 gap-1.5 bg-white dark:bg-slate-900 min-w-[130px]">
                                <CalendarIcon size={14} className="text-red-500 shrink-0" />
                                <div className="flex flex-col flex-1">
                                    <span className="text-[8px] font-bold text-slate-400 leading-none">Start</span>
                                    <input
                                        type="date"
                                        value={customStartDate}
                                        onChange={e => setCustomStartDate(e.target.value)}
                                        style={{ colorScheme: 'dark' }}
                                        className="bg-transparent border-none outline-none text-[11px] font-bold text-slate-700 dark:text-slate-100 w-full"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase ml-1">End Date</span>
                            <div className="relative border border-red-400 dark:border-red-900/50 rounded-lg h-11 flex items-center px-2.5 gap-1.5 bg-white dark:bg-slate-900 min-w-[130px]">
                                <CalendarIcon size={14} className="text-red-500 shrink-0" />
                                <div className="flex flex-col flex-1">
                                    <span className="text-[8px] font-bold text-slate-400 leading-none">End</span>
                                    <input
                                        type="date"
                                        value={customEndDate}
                                        onChange={e => setCustomEndDate(e.target.value)}
                                        style={{ colorScheme: 'dark' }}
                                        className="bg-transparent border-none outline-none text-[11px] font-bold text-slate-700 dark:text-slate-100 w-full"
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
                        <div className="absolute top-[calc(100%+8px)] left-0 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-4 flex flex-col gap-4 min-w-[240px] animate-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-700 dark:text-slate-100 uppercase tracking-widest">Filters</span>
                                <button onClick={handleClearFilters} className="text-[10px] font-bold text-red-500 hover:underline">Clear All</button>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Assigned By</label>
                                <select value={assignedBy} onChange={e => setAssignedBy(e.target.value)} style={{ colorScheme: 'dark' }} className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2 rounded-lg text-xs font-bold outline-none text-slate-700 dark:text-slate-100">
                                    <option value="All">Anyone</option>
                                    {users.map(u => <option key={u.userId || u.id} value={u.userId || u.id}>{u.firstName} {u.lastName}</option>)}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Priority</label>
                                <select value={priority} onChange={e => setPriority(e.target.value)} style={{ colorScheme: 'dark' }} className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2 rounded-lg text-xs font-bold outline-none text-slate-700 dark:text-slate-100">
                                    <option value="All">All Priority</option>
                                    <option value="Urgent">Urgent</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Category</label>
                                <select value={category} onChange={e => setCategory(e.target.value)} style={{ colorScheme: 'dark' }} className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2 rounded-lg text-xs font-bold outline-none text-slate-700 dark:text-slate-100">
                                    <option value="All">All Categories</option>
                                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Tag</label>
                                <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} style={{ colorScheme: 'dark' }} className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2 rounded-lg text-xs font-bold outline-none text-slate-700 dark:text-slate-100">
                                    <option value="All">All Tags</option>
                                    {allTags.map(t => <option key={t} value={t}>{t}</option>)}
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
                            className="w-full h-11 pl-10 pr-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-red-400/20 focus:border-red-300 text-slate-700 dark:text-slate-100"
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
                                style={{ colorScheme: 'dark' }}
                                className="w-full h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-3 pr-8 text-sm font-bold text-slate-700 dark:text-slate-100 outline-none appearance-none cursor-pointer shadow-sm focus:border-red-400"
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
                            className="h-11 w-11 flex justify-center items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors shadow-sm active:scale-95"
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
                    {tagFilter !== 'All' && <FilterChip label={`Tag: ${tagFilter}`} onRemove={() => setTagFilter('All')} />}
                </div>
            )}

            {/* ── Status Tabs ── */}
            <div className="flex justify-center mb-8 border-b border-slate-200 dark:border-slate-800 relative">
                <div className="flex gap-6 overflow-x-auto no-scrollbar">
                    {[
                        { label: 'All',         dotClass: 'bg-slate-400',                              key: 'All' },
                        { label: 'Overdue',     dotClass: 'bg-red-500',                                key: 'Overdue' },
                        { label: 'Pending',     dotClass: 'border-2 border-slate-400 bg-transparent',  key: 'Pending' },
                        { label: 'In Progress', dotClass: 'bg-orange-500',                             key: 'In Progress' },
                        { label: 'Completed',   dotClass: 'bg-emerald-500',                            key: 'Completed' },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setStatusFilter(tab.key)}
                            className={`flex items-center gap-2 pb-4 px-2 transition-all relative whitespace-nowrap ${statusFilter === tab.key ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            <div className={`w-3 h-3 rounded-full shrink-0 ${tab.dotClass} ${statusFilter === tab.key ? 'ring-2 ring-red-500/20 shadow-sm' : ''}`} />
                            <span className="text-sm font-bold uppercase tracking-wide">
                                {tab.label} — <span className={`${statusFilter === tab.key ? 'text-red-500 dark:text-red-400 font-black' : 'text-slate-500 dark:text-slate-500 font-bold'} transition-colors`}>{getStatusCount(tab.key)}</span>
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
                    <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-20 flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-5">
                            <Trash2 size={32} className="text-slate-300 dark:text-slate-600" />
                        </div>
                        <h3 className="text-lg font-black text-slate-700 dark:text-slate-200">Trash Is Empty</h3>
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
                            <div key={task.id} className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 premium-shadow premium-shadow-hover transition-all duration-300 p-5 flex items-start gap-5 ${expandedTasks.has(task.id) ? 'ring-2 ring-red-500/20 shadow-md' : ''}`}>

                                {/* Avatar */}
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center text-white font-black text-sm shrink-0 shadow">
                                    {(task.doerFirstName?.[0] || 'U')}{(task.doerLastName?.[0] || '')}
                                </div>

                                {/* Body */}
                                <div className="flex-1 min-w-0">
                                    {/* Top row */}
                                    <div className="flex items-center gap-3 flex-wrap mb-1">
                                        <span className="font-black text-slate-700 dark:text-slate-200 text-sm">
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
                                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100 truncate mb-2">{task.taskTitle}</h3>

                                    {/* Meta */}
                                    <div className="flex flex-wrap items-center gap-3 text-xs">
                                        <span className="text-slate-400 font-semibold">
                                            Assigned By <span className="font-black text-slate-700 dark:text-slate-300">{task.assignerFirstName} {task.assignerLastName}</span>
                                        </span>

                                        {task.dueDate && (
                                            <span className={`flex items-center gap-1.5 font-bold ${st === 'OverDue' ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                                                <Clock size={12} />
                                                {fmt(task.dueDate)}
                                                {st === 'OverDue' && ' | Overdue'}
                                            </span>
                                        )}

                                        <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-bold text-[11px] ${st === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800' : st === 'In Progress' ? 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/10 dark:text-orange-400 dark:border-orange-800' : st === 'OverDue' ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/10 dark:text-red-400 dark:border-red-800' : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${st === 'Completed' ? 'bg-emerald-500' : st === 'In Progress' ? 'bg-orange-500' : st === 'OverDue' ? 'bg-red-500' : 'bg-slate-400'}`} />
                                            {st}
                                        </span>

                                        {task.priority && (
                                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border font-bold text-[11px] ${task.priority === 'Urgent' ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/10 dark:text-red-400 dark:border-red-800' : task.priority === 'High' ? 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/10 dark:text-orange-400 dark:border-orange-800' : task.priority === 'Medium' ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-800' : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
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
                                    onClick={() => handleRestore(task.id)}
                                    disabled={restoringId === task.id}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 hover:border-[#137fec] text-slate-500 dark:text-slate-400 hover:text-[#137fec] dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 font-bold text-sm transition-all active:scale-95 disabled:opacity-50 shrink-0"
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
    );
};

export default DeletedTasks;
