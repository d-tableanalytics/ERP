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

const PRIORITY_COLORS = {
    Urgent: { bg: 'bg-red-50',    text: 'text-red-500',    border: 'border-red-200',    dot: 'bg-red-500' },
    High:   { bg: 'bg-orange-50', text: 'text-orange-500', border: 'border-orange-200', dot: 'bg-orange-500' },
    Medium: { bg: 'bg-amber-50',  text: 'text-amber-600',  border: 'border-amber-200',  dot: 'bg-amber-500' },
    Low:    { bg: 'bg-blue-50',   text: 'text-[#137fec]', border: 'border-blue-200',   dot: 'bg-[#137fec]' },
};

const STATUS_MAP = {
    OverDue:      { dot: 'bg-red-500',     text: 'text-red-500',     bg: 'bg-red-50',    border: 'border-red-200' },
    Pending:      { dot: 'border-2 border-slate-400 bg-transparent', text: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200' },
    'In Progress':{ dot: 'bg-orange-500',  text: 'text-orange-600',  bg: 'bg-orange-50', border: 'border-orange-200' },
    Completed:    { dot: 'bg-[#137fec]', text: 'text-[#137fec]', bg: 'bg-blue-50',    border: 'border-blue-200' },
};

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// ── FilterChip ───────────────────────────────────────────────────────────────

const FilterChip = ({ label, onRemove }) => (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#137fec]/40 text-[#137fec] rounded-full text-[11px] font-bold">
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
            await delegationService.restoreDelegation(id);
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
            <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
                <div className="text-center p-12 bg-white rounded-3xl shadow-sm border border-slate-100 max-w-sm">
                    <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
                        <Shield size={36} className="text-red-400" />
                    </div>
                    <h2 className="text-xl font-black text-slate-800 mb-2">ADMIN Only</h2>
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
                        <h1 className="text-2xl font-black text-slate-800 leading-none">Deleted Tasks</h1>
                        <p className="text-xs font-bold text-slate-400 mt-0.5">ADMIN View — Trash Bin</p>
                    </div>
                </div>
                <button
                    onClick={fetchAllData}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm transition shadow-sm"
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
                            className="w-full h-11 bg-white border border-red-400 rounded-lg pl-3 pr-8 text-sm font-bold text-slate-700 outline-none appearance-none cursor-pointer shadow-sm"
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
                            <div className="relative border border-red-400 rounded-lg h-11 flex items-center px-2.5 gap-1.5 bg-white min-w-[130px]">
                                <CalendarIcon size={14} className="text-red-500 shrink-0" />
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-bold text-slate-400 leading-none">Start</span>
                                    <input
                                        type="date"
                                        value={customStartDate}
                                        onChange={e => setCustomStartDate(e.target.value)}
                                        className="bg-transparent border-none outline-none text-[11px] font-bold text-slate-700 w-full"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase ml-1">End Date</span>
                            <div className="relative border border-red-400 rounded-lg h-11 flex items-center px-2.5 gap-1.5 bg-white min-w-[130px]">
                                <CalendarIcon size={14} className="text-red-500 shrink-0" />
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-bold text-slate-400 leading-none">End</span>
                                    <input
                                        type="date"
                                        value={customEndDate}
                                        onChange={e => setCustomEndDate(e.target.value)}
                                        className="bg-transparent border-none outline-none text-[11px] font-bold text-slate-700 w-full"
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
                            showFilters ? 'bg-slate-800 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                        }`}
                    >
                        <Filter size={18} />
                        Filter
                        {activeFilterCount > 0 && (
                            <span className="bg-white text-red-500 text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>

                    {showFilters && (
                        <div className="absolute top-[calc(100%+8px)] left-0 z-50 bg-white border border-slate-200 rounded-xl shadow-2xl p-4 flex flex-col gap-4 min-w-[240px] animate-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Filters</span>
                                <button onClick={handleClearFilters} className="text-[10px] font-bold text-red-500 hover:underline">Clear All</button>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Assigned By</label>
                                <select value={assignedBy} onChange={e => setAssignedBy(e.target.value)} className="bg-slate-50 border border-slate-100 p-2 rounded-lg text-xs font-bold outline-none">
                                    <option value="All">Anyone</option>
                                    {users.map(u => <option key={u.userId || u.id} value={u.userId || u.id}>{u.firstName} {u.lastName}</option>)}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Priority</label>
                                <select value={priority} onChange={e => setPriority(e.target.value)} className="bg-slate-50 border border-slate-100 p-2 rounded-lg text-xs font-bold outline-none">
                                    <option value="All">All Priority</option>
                                    <option value="Urgent">Urgent</option>
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Category</label>
                                <select value={category} onChange={e => setCategory(e.target.value)} className="bg-slate-50 border border-slate-100 p-2 rounded-lg text-xs font-bold outline-none">
                                    <option value="All">All Categories</option>
                                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Tag</label>
                                <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} className="bg-slate-50 border border-slate-100 p-2 rounded-lg text-xs font-bold outline-none">
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
                            className="w-full h-11 pl-10 pr-10 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-red-400/20 focus:border-red-300"
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
                        className="h-11 w-11 flex items-center justify-center bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-sm"
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
                                className="w-full h-11 bg-white border border-slate-200 rounded-lg pl-3 pr-8 text-sm font-bold text-slate-700 outline-none appearance-none cursor-pointer shadow-sm focus:border-red-400"
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
                            className="h-11 w-11 flex justify-center items-center bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors shadow-sm"
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
            <div className="flex justify-center mb-8 border-b border-slate-200 relative">
                <div className="flex flex-wrap gap-6">
                    {[
                        { label: 'All',         dotClass: 'bg-slate-400',                              key: 'All' },
                        { label: 'OverDue',     dotClass: 'bg-red-500',                                key: 'OverDue' },
                        { label: 'Pending',     dotClass: 'border-2 border-slate-400 bg-transparent',  key: 'Pending' },
                        { label: 'In Progress', dotClass: 'bg-orange-500',                             key: 'In Progress' },
                        { label: 'Completed',   dotClass: 'bg-[#137fec]',                          key: 'Completed' },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setStatusFilter(tab.key)}
                            className={`flex items-center gap-2 pb-4 px-2 transition-all relative whitespace-nowrap ${
                                statusFilter === tab.key ? 'text-slate-800' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <div className={`w-3 h-3 rounded-full shrink-0 ${tab.dotClass}`} />
                            <span className="text-sm font-bold uppercase tracking-wide">
                                {tab.label} — {getStatusCount(tab.key)}
                            </span>
                            {statusFilter === tab.key && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-500 rounded-t-full" />
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
                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-20 flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-5">
                            <Trash2 size={32} className="text-slate-300" />
                        </div>
                        <h3 className="text-lg font-black text-slate-700">Trash Is Empty</h3>
                        <p className="text-slate-400 text-sm font-medium mt-1">
                            {search || activeFilterCount > 0 || statusFilter !== 'All'
                                ? 'No deleted tasks match your filters'
                                : 'No deleted tasks found'}
                        </p>
                        {(activeFilterCount > 0 || statusFilter !== 'All') && (
                            <button
                                onClick={handleClearFilters}
                                className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 transition-all"
                            >
                                Clear Filters
                            </button>
                        )}
                    </div>
                ) : (
                    filteredTasks.map(task => {
                        const st = getStatus(task);
                        const pStyle = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Low;
                        const sStyle = STATUS_MAP[st] || STATUS_MAP.Pending;

                        return (
                            <div key={task.id} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all flex items-start gap-4">

                                {/* Avatar */}
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center text-white font-black text-sm shrink-0 shadow">
                                    {(task.doerFirstName?.[0] || 'U')}{(task.doerLastName?.[0] || '')}
                                </div>

                                {/* Body */}
                                <div className="flex-1 min-w-0">
                                    {/* Top row */}
                                    <div className="flex items-center gap-3 flex-wrap mb-1">
                                        <span className="font-black text-slate-700 text-sm">
                                            {task.doerFirstName} {task.doerLastName}
                                        </span>
                                        {task.category && (
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{task.category}</span>
                                        )}
                                        <span className="text-[11px] font-bold text-red-400 ml-auto">
                                            Deleted {fmt(task.deletedAt)}
                                        </span>
                                    </div>

                                    {/* Title */}
                                    <h3 className="text-base font-black text-slate-800 truncate mb-2">{task.taskTitle}</h3>

                                    {/* Meta */}
                                    <div className="flex flex-wrap items-center gap-3 text-xs">
                                        <span className="text-slate-400 font-semibold">
                                            Assigned By <span className="font-black text-slate-700">{task.assignerFirstName} {task.assignerLastName}</span>
                                        </span>

                                        {task.dueDate && (
                                            <span className={`flex items-center gap-1.5 font-bold ${st === 'OverDue' ? 'text-red-500' : 'text-slate-500'}`}>
                                                <Clock size={12} />
                                                {fmt(task.dueDate)}
                                                {st === 'OverDue' && ' | Overdue'}
                                            </span>
                                        )}

                                        <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-bold text-[11px] ${sStyle.bg} ${sStyle.text} ${sStyle.border}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${sStyle.dot}`} />
                                            {st}
                                        </span>

                                        {task.priority && (
                                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border font-bold text-[11px] ${pStyle.bg} ${pStyle.text} ${pStyle.border}`}>
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
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 hover:border-[#137fec] text-slate-500 hover:text-[#137fec] hover:bg-blue-50 font-bold text-sm transition-all active:scale-95 disabled:opacity-50 shrink-0"
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
