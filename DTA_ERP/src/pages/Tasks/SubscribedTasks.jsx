import React, { useState, useEffect, useRef } from 'react';
import { 
    Search, FileUp, List, Layout, 
    Calendar as CalendarIcon, ChevronDown, Clock, 
    Folder, Flag, User, MoreVertical, CheckSquare, Tag, RotateCcw, 
    Filter, X, CheckCircle2, AlertCircle, PlayCircle, ListTodo, Bell
} from 'lucide-react';
import delegationService from '../../services/delegationService';
import taskService from '../../services/taskService';
import teamService from '../../services/teamService';
import TaskKanbanView from '../../components/delegation/TaskKanbanView';
import TaskCalendarView from '../../components/delegation/TaskCalendarView';
import TaskDetailsDrawer from '../../components/delegation/TaskDetailsDrawer';
import { toast } from 'react-hot-toast';
import MainLayout from '../../components/layout/MainLayout';

// ── Date range helper ───────────────────────────────────────────────────────────
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
        case 'Last Week': {
            const s = new Date(today); s.setDate(today.getDate() - today.getDay() - 6);
            const e = new Date(s); e.setDate(s.getDate() + 6);
            return d >= s && d <= e;
        }
        case 'This Month': return d >= new Date(now.getFullYear(), now.getMonth(), 1);
        case 'Last Month': {
            const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const e = new Date(now.getFullYear(), now.getMonth(), 0);
            return d >= s && d <= e;
        }
        case 'This Year': return d >= new Date(now.getFullYear(), 0, 1);
        case 'Custom': {
            if (!customStart || !customEnd) return true;
            return d >= new Date(customStart) && d <= new Date(customEnd + 'T23:59:59');
        }
        default: return true; // All Time
    }
};

// ── Filter Chip ─────────────────────────────────────────────────────────────────
const FilterChip = ({ label, onRemove }) => (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#137fec]/40 text-[#137fec] rounded-full text-[11px] font-bold">
        {label}
        <button onClick={onRemove} className="hover:text-red-500 transition-colors ml-0.5">
            <X size={12} strokeWidth={3} />
        </button>
    </div>
);

// ── Main Component ──────────────────────────────────────────────────────────────
const InLoopTasks = () => {
    const [tasks, setTasks] = useState([]);
    const [users, setUsers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [allTags, setAllTags] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState('');
    const [dateRange, setDateRange] = useState('All Time');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [priority, setPriority] = useState('All');
    const [category, setCategory] = useState('All');
    const [assignedBy, setAssignedBy] = useState('All');
    const [tagFilter, setTagFilter] = useState('All');
    const [showFilters, setShowFilters] = useState(false);

    // UI
    const [viewMode, setViewMode] = useState('List');
    const [expandedTasks, setExpandedTasks] = useState(new Set());
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const [showDetails, setShowDetails] = useState(false);

    const filterPanelRef = useRef(null);
    const storedUser = JSON.parse(localStorage.getItem('user'));
    const currentUserId = storedUser?.user?.id || storedUser?.id;

    useEffect(() => { fetchAllData(); }, []);

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
            const [taskRes, usersRes, catRes] = await Promise.all([
                taskService.getSubscribedTasks(),
                teamService.getUsers(),
                delegationService.getCategories(),
            ]);
            const allTasks = taskRes.data || [];
            setTasks(allTasks);
            setUsers(Array.isArray(usersRes) ? usersRes : (usersRes.data || []));
            setCategories(catRes.data || catRes || []);

            // Extract unique tags from all in-loop tasks
            const tagSet = new Set();
            allTasks
                .forEach(t => {
                    try {
                        const parsed = typeof t.tags === 'string' ? JSON.parse(t.tags) : (t.tags || []);
                        if (Array.isArray(parsed)) parsed.forEach(tag => tag?.text && tagSet.add(tag.text));
                    } catch (e) {}
                });
            setAllTags(Array.from(tagSet));
        } catch (err) {
            console.error('Failed to fetch data:', err);
            toast.error('Failed to load tasks');
        } finally {
            setLoading(false);
        }
    };

    const toggleTaskExpansion = (taskId) => {
        const s = new Set(expandedTasks);
        s.has(taskId) ? s.delete(taskId) : s.add(taskId);
        setExpandedTasks(s);
    };

    const handleClearFilters = () => {
        setSearch('');
        setDateRange('All Time');
        setCustomStartDate('');
        setCustomEndDate('');
        setStatusFilter('All');
        setPriority('All');
        setCategory('All');
        setAssignedBy('All');
        setTagFilter('All');
    };

    // In Loop tasks = Already filtered by NEW API
    const inLoopTasks = tasks;

    const filteredTasks = inLoopTasks.filter(t => {
        if (search && !t.taskTitle.toLowerCase().includes(search.toLowerCase())) return false;
        if (statusFilter !== 'All' && t.status !== statusFilter) return false;
        if (priority !== 'All' && t.priority !== priority) return false;
        if (category !== 'All' && t.category !== category) return false;
        if (assignedBy !== 'All' && t.assignerId !== assignedBy) return false;
        if (tagFilter !== 'All') {
            try {
                const taskTags = typeof t.tags === 'string' ? JSON.parse(t.tags) : (t.tags || []);
                if (!taskTags.some(tag => tag?.text === tagFilter)) return false;
            } catch (e) { return false; }
        }
        return getDateRangeFilter(t.dueDate || t.createdAt, dateRange, customStartDate, customEndDate);
    });

    const getStatusCount = (status) =>
        status === 'All' ? inLoopTasks.length : inLoopTasks.filter(t => t.status === status).length;

    const formatTimeAgo = (d) => {
        const diff = Math.floor((new Date() - new Date(d)) / 3600000);
        if (diff < 1) return 'Just now';
        if (diff < 24) return `${diff}h ago`;
        return `${Math.floor(diff / 24)}d ago`;
    };

    const getInitials = (f, l) => `${f?.[0] || ''}${l?.[0] || ''}`.toUpperCase();

    const getUserName = (userId) => {
        const u = users.find(u => u.userId === userId || u.id === userId);
        return u ? `${u.firstName} ${u.lastName}` : 'Unknown';
    };

    const activeFilterCount = [
        priority !== 'All', category !== 'All', assignedBy !== 'All', tagFilter !== 'All'
    ].filter(Boolean).length;

    // Quick stats for the top mini-cards
    const quickStats = [
        { label: 'Total', value: inLoopTasks.length, color: 'text-slate-600', bg: 'bg-white', dot: 'bg-slate-400' },
        { label: 'Overdue', value: getStatusCount('Overdue'), color: 'text-red-600', bg: 'bg-red-50', dot: 'bg-red-500' },
        { label: 'Pending', value: getStatusCount('Pending'), color: 'text-slate-500', bg: 'bg-slate-50', dot: 'border-2 border-slate-400' },
        { label: 'In Progress', value: getStatusCount('In Progress'), color: 'text-orange-600', bg: 'bg-orange-50', dot: 'bg-orange-500' },
        { label: 'Completed', value: getStatusCount('Completed'), color: 'text-[#137fec]', bg: 'bg-blue-50', dot: 'bg-[#137fec]' },
    ];

    return (
        <MainLayout title="In Loop Tasks">
            <div className="animate-in fade-in duration-500">

            {/* ── Page Title ── */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-[#137fec] rounded-xl flex items-center justify-center shadow-lg shadow-[#137fec]/30">
                    <Bell size={22} className="text-white" strokeWidth={2.5} />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-slate-800 leading-none">In Loop Tasks</h1>
                    <p className="text-xs font-bold text-slate-400 mt-0.5">Tasks you are copied on for followup</p>
                </div>
            </div>

            {/* ── Quick Stats ── */}
            <div className="flex flex-wrap gap-3 mb-8">
                {quickStats.map((s, i) => (
                    <div key={i} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl ${s.bg} border border-white shadow-sm flex-1 min-w-[100px]`}>
                        <div className={`w-3 h-3 rounded-full shrink-0 ${s.dot}`} />
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{s.label}</p>
                            <p className={`text-xl font-black ${s.color} leading-tight`}>{s.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Toolbar ── */}
            <div className="flex flex-wrap items-end gap-3 mb-8">

                {/* Date Range */}
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date Range</span>
                    <div className="relative min-w-[140px]">
                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                            className="w-full h-11 bg-white border border-[#137fec] rounded-lg pl-3 pr-8 text-sm font-bold text-slate-700 outline-none appearance-none cursor-pointer shadow-sm"
                        >
                            <option value="All Time">All Time</option>
                            <option value="Today">Today</option>
                            <option value="Yesterday">Yesterday</option>
                            <option value="This Week">This Week</option>
                            <option value="Last Week">Last Week</option>
                            <option value="This Month">This Month</option>
                            <option value="Last Month">Last Month</option>
                            <option value="This Year">This Year</option>
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
                            <div className="relative border border-[#137fec] rounded-lg h-11 flex items-center px-2.5 gap-1.5 bg-white min-w-[130px]">
                                <CalendarIcon size={14} className="text-[#137fec] shrink-0" />
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-bold text-slate-400 leading-none">Start</span>
                                    <input
                                        type="date"
                                        value={customStartDate}
                                        onChange={(e) => setCustomStartDate(e.target.value)}
                                        className="bg-transparent border-none outline-none text-[11px] font-bold text-slate-700 w-full"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase ml-1">End Date</span>
                            <div className="relative border border-[#137fec] rounded-lg h-11 flex items-center px-2.5 gap-1.5 bg-white min-w-[130px]">
                                <CalendarIcon size={14} className="text-[#137fec] shrink-0" />
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-bold text-slate-400 leading-none">End</span>
                                    <input
                                        type="date"
                                        value={customEndDate}
                                        onChange={(e) => setCustomEndDate(e.target.value)}
                                        className="bg-transparent border-none outline-none text-[11px] font-bold text-slate-700 w-full"
                                    />
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Filter Dropdown */}
                <div className="relative flex flex-col gap-1" ref={filterPanelRef}>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 invisible select-none">_</span>
                    <button
                        onClick={() => setShowFilters(v => !v)}
                        className={`flex items-center gap-2 px-5 h-11 rounded-lg font-bold text-sm transition-all shadow-sm ${showFilters ? 'bg-slate-800 text-white' : 'bg-[#137fec] hover:bg-[#106bc7] text-white'}`}
                    >
                        <Filter size={18} />
                        Filter
                        {activeFilterCount > 0 && (
                            <span className="bg-white text-[#137fec] text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>

                    {showFilters && (
                        <div className="absolute top-[calc(100%+8px)] left-0 z-50 bg-white border border-slate-200 rounded-xl shadow-2xl p-4 flex flex-col gap-4 min-w-[240px] animate-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Filters</span>
                                <button onClick={handleClearFilters} className="text-[10px] font-bold text-[#137fec] hover:underline">Clear All</button>
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
                            placeholder="Search in loop tasks..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>
                </div>

                {/* Clear */}
                <button
                    onClick={handleClearFilters}
                    title="Clear Filters"
                    className="h-11 w-11 flex items-center justify-center bg-[#137fec] text-white rounded-lg hover:bg-[#106bc7] transition-all shadow-sm self-end"
                >
                    <RotateCcw size={18} strokeWidth={3} />
                </button>

                {/* Export */}
                <button className="flex items-center gap-2 px-4 h-11 bg-[#137fec] hover:bg-[#106bc7] text-white rounded-lg font-bold text-sm transition-all shadow-sm self-end">
                    <FileUp size={18} />
                    Export
                </button>

                {/* View Mode */}
                <div className="flex bg-white rounded-lg p-1 border border-slate-200 h-11 items-center self-end">
                    {[
                        { mode: 'List', icon: List },
                        { mode: 'Kanban', icon: Layout },
                        { mode: 'Calendar', icon: CalendarIcon }
                    ].map(({ mode, icon: Icon }) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`p-2 rounded-md transition-all ${viewMode === mode ? 'bg-[#137fec] text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
                        >
                            <Icon size={18} />
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Status Tabs ── */}
            <div className="flex justify-center mb-8 border-b border-white/20 relative">
                <div className="flex gap-6 overflow-x-auto">
                    {[
                        { label: 'All', dotClass: 'bg-slate-400', key: 'All' },
                        { label: 'Overdue', dotClass: 'bg-red-500', key: 'Overdue' },
                        { label: 'Pending', dotClass: 'border-2 border-slate-400 bg-transparent', key: 'Pending' },
                        { label: 'In Progress', dotClass: 'bg-orange-500', key: 'In Progress' },
                        { label: 'Completed', dotClass: 'bg-[#137fec]', key: 'Completed' },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setStatusFilter(tab.key)}
                            className={`flex items-center gap-2 pb-4 px-2 transition-all relative whitespace-nowrap ${statusFilter === tab.key ? 'text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <div className={`w-3 h-3 rounded-full shrink-0 ${tab.dotClass}`} />
                            <span className="text-sm font-bold uppercase tracking-wide">
                                {tab.label} — {getStatusCount(tab.key)}
                            </span>
                            {statusFilter === tab.key && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#137fec] rounded-t-full" />
                            )}
                        </button>
                    ))}
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

            {/* ── Task List ── */}
            <div className="max-w-7xl mx-auto space-y-3 pb-20">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-12 h-12 border-4 border-[#137fec] border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Loading In Loop Tasks...</p>
                    </div>
                ) : filteredTasks.length === 0 ? (
                    <div className="bg-white/40 border-2 border-dashed border-white/60 rounded-3xl p-20 flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 bg-white/60 rounded-full flex items-center justify-center mb-6">
                            <CheckSquare size={40} className="text-slate-300" />
                        </div>
                        <h3 className="text-xl font-black text-slate-700 mb-2">
                            {inLoopTasks.length === 0 ? 'No Tasks In-Loop' : 'No Tasks Match Filters'}
                        </h3>
                        <p className="text-slate-500 font-medium">
                            {inLoopTasks.length === 0
                                ? 'Tasks you are copied on will appear here.'
                                : 'Try changing your filters or date range.'}
                        </p>
                        {activeFilterCount > 0 && (
                            <button onClick={handleClearFilters} className="mt-4 px-4 py-2 bg-[#137fec] text-white rounded-lg text-sm font-bold hover:bg-[#106bc7] transition-all">
                                Clear Filters
                            </button>
                        )}
                    </div>
                ) : viewMode === 'List' ? (
                    filteredTasks.map((task) => (
                        <div
                            key={task.id}
                            className={`bg-white rounded-xl border border-white shadow-sm transition-all duration-300 ${expandedTasks.has(task.id) ? 'ring-2 ring-[#137fec]/30' : 'hover:shadow-md'}`}
                        >
                            <div
                                className="p-4 flex items-center gap-4 cursor-pointer"
                                onClick={() => toggleTaskExpansion(task.id)}
                            >
                                <input type="checkbox" className="w-5 h-5 rounded border-slate-300 accent-[#137fec]" onClick={e => e.stopPropagation()} />

                                {/* Assigner avatar */}
                                <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold relative shrink-0"
                                    title={`Assigned by ${task.assignerFirstName || ''} ${task.assignerLastName || ''}`}>
                                    <div className="absolute inset-0 rounded-full border-2 border-purple-300 opacity-60" />
                                    {`${task.assignerFirstName?.[0] || ''}${task.assignerLastName?.[0] || ''}`.toUpperCase() || '?'}
                                </div>

                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-xs font-bold text-slate-400 whitespace-nowrap hidden sm:block">
                                            From: {task.assignerFirstName} {task.assignerLastName}
                                        </span>
                                        <span className="text-base font-black text-slate-800 truncate">{task.taskTitle}</span>
                                    </div>
                                    <div className="ml-auto flex items-center gap-3 shrink-0">
                                        {/* Status badge */}
                                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase border whitespace-nowrap hidden md:inline-flex ${
                                            task.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                            task.status === 'In Progress' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                                            task.status === 'Overdue' ? 'bg-red-50 text-red-600 border-red-200' :
                                            task.status === 'Hold' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                            'bg-slate-50 text-slate-500 border-slate-200'
                                        }`}>{task.status}</span>

                                        {/* Due date */}
                                        {task.dueDate && (
                                            <span className={`text-[11px] font-bold whitespace-nowrap hidden md:block ${new Date(task.dueDate) < new Date() && task.status !== 'Completed' ? 'text-red-500' : 'text-slate-400'}`}>
                                                📅 {new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                            </span>
                                        )}

                                        {task.priority && (
                                            <span className={`text-[10px] font-black hidden md:block ${
                                                task.priority === 'Urgent' ? 'text-red-500' :
                                                task.priority === 'High' ? 'text-orange-500' :
                                                task.priority === 'Medium' ? 'text-blue-500' : 'text-slate-400'
                                            }`}>● {task.priority}</span>
                                        )}

                                        <span className="text-[11px] font-black text-slate-400 whitespace-nowrap">{formatTimeAgo(task.createdAt)}</span>

                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedTaskId(task.id); setShowDetails(true); }}
                                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-[#137fec] transition-all"
                                            title="View Details"
                                        >
                                            <MoreVertical size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded */}
                            {expandedTasks.has(task.id) && (
                                <div className="px-6 pb-5 pt-2 border-t border-slate-50 animate-in slide-in-from-top-2 duration-300 space-y-3">
                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-bold text-slate-400 pt-2">
                                        <div className="flex items-center gap-1.5 text-slate-500">
                                            <Clock size={14} className="text-red-400" />
                                            Due: {task.dueDate
                                                ? new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                                : 'No date set'}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <User size={14} className="text-purple-400" />
                                            Assigned by: <span className="text-slate-600">{task.assignerFirstName} {task.assignerLastName}</span>
                                        </div>
                                        {task.category && (
                                            <div className="flex items-center gap-1.5">
                                                <Folder size={14} className="text-slate-400" />
                                                {task.category}
                                            </div>
                                        )}
                                        {task.priority && (
                                            <div className={`flex items-center gap-1.5 ${task.priority === 'Urgent' ? 'text-red-500' : task.priority === 'High' ? 'text-orange-500' : 'text-slate-500'}`}>
                                                <Flag size={14} fill="currentColor" />
                                                {task.priority}
                                            </div>
                                        )}
                                    </div>

                                    {/* Description snippet */}
                                    {task.description && (
                                        <p className="text-xs text-slate-500 font-medium leading-relaxed line-clamp-2 border-l-2 border-[#137fec]/30 pl-3">
                                            {task.description}
                                        </p>
                                    )}

                                    {/* Tags */}
                                    {(() => {
                                        try {
                                            const parsed = typeof task.tags === 'string' ? JSON.parse(task.tags) : (task.tags || []);
                                            if (!Array.isArray(parsed) || parsed.length === 0) return null;
                                            return (
                                                <div className="flex flex-wrap gap-2">
                                                    {parsed.map((tag, i) => (
                                                        <div
                                                            key={i}
                                                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest"
                                                            style={{ backgroundColor: `${tag.color}12`, borderColor: `${tag.color}30`, color: tag.color }}
                                                        >
                                                            <Tag size={10} strokeWidth={3} />
                                                            {tag.text}
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        } catch (e) { return null; }
                                    })()}

                                    {/* Quick action */}
                                    <div className="pt-1">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedTaskId(task.id); setShowDetails(true); }}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all"
                                        >
                                            <Bell size={14} strokeWidth={3} />
                                            View Details
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                ) : viewMode === 'Kanban' ? (
                    <TaskKanbanView tasks={filteredTasks} onTaskClick={(task) => { setSelectedTaskId(task.id); setShowDetails(true); }} />
                ) : (
                    <TaskCalendarView tasks={filteredTasks} onTaskClick={(task) => { setSelectedTaskId(task.id); setShowDetails(true); }} />
                )}
            </div>

            <TaskDetailsDrawer
                isOpen={showDetails}
                taskId={selectedTaskId}
                onClose={() => setShowDetails(false)}
                onSuccess={fetchAllData}
            />
            </div>
        </MainLayout>
    );
};

export default InLoopTasks;
