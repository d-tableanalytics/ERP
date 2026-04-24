import React, { useState, useEffect, useRef } from 'react';
import {
    Search, FileUp, List, Layout,
    Calendar as CalendarIcon, ChevronDown, Clock,
    Folder, Flag, User, MoreVertical, CheckSquare, Tag, RotateCcw,
    Filter, X, CheckCircle2, AlertCircle, PlayCircle, ListTodo, ArrowUpDown, FilePlus,
    Paperclip, Mic
} from 'lucide-react';
import delegationService from '../../services/delegationService';
import taskService from '../../services/taskService';
import teamService from '../../services/teamService';
import TaskKanbanView from '../../components/delegation/TaskKanbanView';
import TaskCalendarView from '../../components/delegation/TaskCalendarView';
import TaskDetailsDrawer from '../../components/delegation/TaskDetailsDrawer';
import TaskCreationForm from '../../components/delegation/TaskCreationForm';
import { toast } from 'react-hot-toast';
import MainLayout from '../../components/layout/MainLayout';
import { useSelector } from 'react-redux';

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
    <div className="flex items-center gap-1.5 px-3 py-1 bg-bg-card border border-[#137fec]/40 dark:border-[#137fec]/20 text-[#137fec] rounded-full text-[11px] font-bold">
        {label}
        <button onClick={onRemove} className="hover:text-red-500 transition-colors ml-0.5">
            <X size={12} strokeWidth={3} />
        </button>
    </div>
);

// ── Main Component ──────────────────────────────────────────────────────────────
const MyTasks = () => {
    const [tasks, setTasks] = useState([]);
    const [users, setUsers] = useState([]);
    const [categories, setCategories] = useState([]);
    const [allDepartments, setAllDepartments] = useState([]);
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
    const [departmentFilter, setDepartmentFilter] = useState('All');
    const [showFilters, setShowFilters] = useState(false);

    // UI
    const [viewMode, setViewMode] = useState('List');
    const [expandedTasks, setExpandedTasks] = useState(new Set());
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    const [showDelegationDrawer, setShowDelegationDrawer] = useState(false);
    const currentRole = useSelector((state) => state.auth.user?.role || state.auth.user?.Role || '');
    const canCreateTask = ['admin', 'superadmin'].includes((currentRole || '').toLowerCase());

    // Sort
    const [sortBy, setSortBy] = useState('Target Date');
    const [sortDesc, setSortDesc] = useState(true);

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
                taskService.getMyTasks(),
                teamService.getUsers(),
                delegationService.getCategories(),
            ]);
            const allTasks = taskRes || [];
            setTasks(allTasks);
            setUsers(Array.isArray(usersRes) ? usersRes : (usersRes.data || []));
            setCategories(catRes.data || catRes || []);

            // Extract unique departments from all my tasks
            const deptSet = new Set();
            allTasks.forEach(t => { if (t.department) deptSet.add(t.department); });
            setAllDepartments(Array.from(deptSet).sort());
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
        setDepartmentFilter('All');
    };

    // My tasks = tasks where current user is the DOER (Already filtered by NEW API)
    const myTasks = tasks;

    const filteredTasks = myTasks.filter(t => {
        if (search && !t.taskTitle.toLowerCase().includes(search.toLowerCase())) return false;
        if (statusFilter !== 'All' && t.status !== statusFilter) return false;
        if (priority !== 'All' && t.priority !== priority) return false;
        if (category !== 'All' && t.category !== category) return false;
        if (assignedBy !== 'All' && t.assignerId !== assignedBy) return false;
        if (departmentFilter !== 'All' && t.department !== departmentFilter) return false;
        return getDateRangeFilter(t.dueDate || t.createdAt, dateRange, customStartDate, customEndDate);
    });

    const sortedTasks = [...filteredTasks].sort((a, b) => {
        let valA, valB;
        if (sortBy === 'Target Date') {
            valA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
            valB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        } else if (sortBy === 'Created At') {
            valA = new Date(a.createdAt).getTime();
            valB = new Date(b.createdAt).getTime();
        } else if (sortBy === 'Title') {
            valA = (a.taskTitle || '').toLowerCase();
            valB = (b.taskTitle || '').toLowerCase();
        } else if (sortBy === 'Category Name') {
            valA = (a.category || '').toLowerCase();
            valB = (b.category || '').toLowerCase();
        }

        if (typeof valA === 'string') {
            return sortDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
        }
        return sortDesc ? (valB - valA) : (valA - valB);
    });

    const getStatusCount = (status) =>
        status === 'All' ? myTasks.length : myTasks.filter(t => t.status === status).length;

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
        priority !== 'All', category !== 'All', assignedBy !== 'All', departmentFilter !== 'All'
    ].filter(Boolean).length;

    // Quick stats for the top mini-cards
    const quickStats = [
        { label: 'Total', value: myTasks.length, dot: 'bg-slate-400', bg: 'bg-bg-card', border: 'border-border-main', color: 'text-text-main' },
        { label: 'Overdue', value: getStatusCount('Overdue'), dot: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-900/10', border: 'border-red-100 dark:border-red-900/20', color: 'text-red-600 dark:text-red-400' },
        { label: 'Pending', value: getStatusCount('Pending'), dot: 'border-2 border-slate-400 bg-transparent', bg: 'bg-bg-main', border: 'border-border-main', color: 'text-text-muted' },
        { label: 'In Progress', value: getStatusCount('In Progress'), dot: 'bg-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/10', border: 'border-orange-100 dark:border-orange-900/20', color: 'text-orange-600 dark:text-orange-400' },
        { label: 'Completed', value: getStatusCount('Completed'), dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-100 dark:border-emerald-900/20', color: 'text-emerald-600 dark:text-emerald-400' },
    ];

    return (
        <MainLayout title="My Tasks">
            <div className="animate-in fade-in duration-500">

                {/* ── Page Title ── */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-[#137fec] rounded-xl flex items-center justify-center shadow-lg shadow-[#137fec]/30">
                        <ListTodo size={22} className="text-white" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-text-main leading-none">My Tasks</h1>
                        <p className="text-xs font-bold text-slate-400 mt-0.5">Tasks assigned to you</p>
                    </div>
                </div>

                {/* ── Quick Stats ── */}
                <div className="flex flex-wrap gap-4 mb-8">
                    {quickStats.map((s, i) => (
                        <div key={i} className={`flex items-center gap-3.5 px-5 py-4 premium-card ${s.bg} ${s.border} flex-1 min-w-[120px]`}>
                            <div className={`w-3.5 h-3.5 rounded-full shrink-0 shadow-sm ${s.dot}`} />
                            <div>
                                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-none mb-1.5">{s.label}</p>
                                <p className={`text-2xl font-black ${s.color} leading-none tracking-tight`}>{s.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Toolbar ── */}
                <div className="flex flex-wrap items-end gap-3 mb-8">

                    {/* Assign Task Button */}
                    {canCreateTask && (
                        <button
                            onClick={() => setShowDelegationDrawer(true)}
                            className="flex items-center gap-2 px-5 h-11 bg-[#137fec] hover:bg-[#106bc7] text-white rounded-lg font-bold text-sm transition-all shadow-sm self-end active:scale-95"
                        >
                            <FilePlus size={18} strokeWidth={2.5} /> Assign Task
                        </button>
                    )}

                    {/* Date Range */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date Range</span>
                        <div className="relative min-w-[140px]">
                            <select
                                value={dateRange}
                                onChange={(e) => setDateRange(e.target.value)}
                                className="w-full h-11 bg-bg-card border-2 border-primary/20 hover:border-primary/40 rounded-xl pl-3 pr-8 text-sm font-bold text-text-main outline-none appearance-none cursor-pointer shadow-sm transition-all"
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
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                        </div>
                    </div>

                    {/* Custom Date Pickers */}
                    {dateRange === 'Custom' && (
                        <>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase ml-1">Start Date</span>
                                <div className="relative border border-[#137fec] dark:border-slate-800 rounded-lg h-11 flex items-center px-2.5 gap-1.5 bg-bg-card min-w-[130px]">
                                    <CalendarIcon size={14} className="text-[#137fec] shrink-0" />
                                    <div className="flex flex-col flex-1">
                                        <span className="text-[8px] font-bold text-slate-400 leading-none">Start</span>
                                        <input
                                            type="date"
                                            value={customStartDate}
                                            onChange={(e) => setCustomStartDate(e.target.value)}
                                            
                                            className="bg-transparent border-none outline-none text-[11px] font-bold text-text-main w-full"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase ml-1">End Date</span>
                                <div className="relative border border-[#137fec] dark:border-slate-800 rounded-lg h-11 flex items-center px-2.5 gap-1.5 bg-bg-card min-w-[130px]">
                                    <CalendarIcon size={14} className="text-[#137fec] shrink-0" />
                                    <div className="flex flex-col flex-1">
                                        <span className="text-[8px] font-bold text-slate-400 leading-none">End</span>
                                        <input
                                            type="date"
                                            value={customEndDate}
                                            onChange={(e) => setCustomEndDate(e.target.value)}
                                            
                                            className="bg-transparent border-none outline-none text-[11px] font-bold text-text-main w-full"
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
                            className={`flex items-center gap-2 px-5 h-11 rounded-lg font-bold text-sm transition-all shadow-sm ${showFilters ? 'bg-slate-800 dark:bg-slate-700 text-white' : 'bg-[#137fec] hover:bg-[#106bc7] text-white'}`}
                        >
                            <Filter size={18} />
                            Filter
                            {activeFilterCount > 0 && (
                                <span className="bg-white text-[#137fec] text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center border border-white dark:border-slate-700/50 shadow-sm">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        {showFilters && (
                            <div className="absolute top-[calc(100%+8px)] left-0 z-50 bg-bg-card border border-border-main rounded-xl shadow-2xl p-4 flex flex-col gap-4 min-w-[240px] animate-in slide-in-from-top-2 duration-200">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-text-main uppercase tracking-widest">Filters</span>
                                    <button onClick={handleClearFilters} className="text-[10px] font-bold text-[#137fec] hover:underline">Clear All</button>
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
                                placeholder="Search my tasks..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full h-11 pl-10 pr-4 bg-bg-card border border-border-main rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-[#137fec]/20 text-text-main"
                            />
                        </div>
                    </div>

                    {/* Clear */}
                    <button
                        onClick={handleClearFilters}
                        title="Clear Filters"
                        className="h-11 w-11 flex items-center justify-center bg-[#137fec] text-white rounded-lg hover:bg-[#106bc7] transition-all shadow-sm self-end active:scale-95"
                    >
                        <RotateCcw size={18} strokeWidth={3} />
                    </button>

                    {/* Export */}
                    <button className="flex items-center gap-2 px-4 h-11 bg-[#137fec] hover:bg-[#106bc7] text-white rounded-lg font-bold text-sm transition-all shadow-sm self-end active:scale-95">
                        <FileUp size={18} />
                        Export
                    </button>

                    {/* View Mode */}
                    <div className="flex bg-bg-card rounded-lg p-1 border border-border-main h-11 items-center self-end">
                        {[
                            { mode: 'List', icon: List },
                            { mode: 'Kanban', icon: Layout },
                            { mode: 'Calendar', icon: CalendarIcon }
                        ].map(({ mode, icon: Icon }) => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`p-2 rounded-md transition-all ${viewMode === mode ? 'bg-[#137fec] text-white shadow-sm' : 'text-slate-400 hover:bg-bg-main'}`}
                            >
                                <Icon size={18} />
                            </button>
                        ))}
                    </div>

                    {/* Sort By */}
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 invisible select-none">_</span>
                        <div className="flex items-center gap-2">
                            <div className="relative min-w-[140px]">
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="w-full h-11 bg-bg-card border border-border-main rounded-lg pl-3 pr-8 text-sm font-bold text-text-main outline-none appearance-none cursor-pointer shadow-sm focus:border-[#137fec]"
                                    
                                >
                                    <option value="Target Date">Target Date</option>
                                    <option value="Created At">Created At</option>
                                    <option value="Title">Title</option>
                                    <option value="Category Name">Category Name</option>
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                            <button
                                onClick={() => setSortDesc(!sortDesc)}
                                className="h-11 w-11 flex justify-center items-center bg-bg-card border border-border-main rounded-lg text-text-muted hover:text-slate-800 dark:hover:text-slate-200 transition-colors shadow-sm focus:border-[#137fec] active:scale-95"
                                title={sortDesc ? 'Descending' : 'Ascending'}
                            >
                                <ArrowUpDown size={18} className={sortDesc ? '' : 'rotate-180 transform transition-transform'} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Status Tabs ── */}
                <div className="flex justify-center mb-8 border-b border-border-main relative">
                    <div className="flex gap-6 overflow-x-auto no-scrollbar">
                        {[
                            { label: 'All', dotClass: 'bg-slate-400', key: 'All' },
                            { label: 'Overdue', dotClass: 'bg-red-500', key: 'Overdue' },
                            { label: 'Pending', dotClass: 'border-2 border-slate-400 bg-transparent', key: 'Pending' },
                            { label: 'In Progress', dotClass: 'bg-orange-500', key: 'In Progress' },
                            { label: 'Completed', dotClass: 'bg-emerald-500', key: 'Completed' },
                        ].map((tab) => (
                             <button
                                 key={tab.key}
                                 onClick={() => setStatusFilter(tab.key)}
                                 className={`flex items-center gap-2 pb-4 px-2 transition-all relative whitespace-nowrap ${statusFilter === tab.key ? 'text-text-main' : 'text-text-muted hover:text-text-main'}`}
                             >
                                 <div className={`w-3 h-3 rounded-full shrink-0 ${tab.dotClass} ${statusFilter === tab.key ? 'ring-2 ring-primary/20 shadow-sm' : ''}`} />
                                 <span className="text-sm font-bold uppercase tracking-wide">
                                     {tab.label} — <span className={`${statusFilter === tab.key ? 'text-primary dark:text-blue-400 font-black' : 'text-text-muted font-bold'} transition-colors`}>{getStatusCount(tab.key)}</span>
                                 </span>
                                 {statusFilter === tab.key && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full shadow-[0_-2px_10px_rgba(19,127,236,0.4)]" />}
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
                        {departmentFilter !== 'All' && <FilterChip label={`Department: ${departmentFilter}`} onRemove={() => setDepartmentFilter('All')} />}
                    </div>
                )}

                {/* ── Task List ── */}
                <div className="max-w-7xl mx-auto space-y-3 pb-20">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-12 h-12 border-4 border-[#137fec] border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Loading My Tasks...</p>
                        </div>
                    ) : filteredTasks.length === 0 ? (
                        <div className="bg-bg-card/40 border-2 border-dashed border-white/60 dark:border-slate-800 rounded-3xl p-20 flex flex-col items-center justify-center text-center">
                            <div className="w-20 h-20 bg-bg-card/60 rounded-full flex items-center justify-center mb-6">
                                <CheckSquare size={40} className="text-slate-300 dark:text-slate-600" />
                            </div>
                            <h3 className="text-xl font-black text-text-main mb-2">
                                {myTasks.length === 0 ? 'No Tasks Assigned to You' : 'No Tasks Match Filters'}
                            </h3>
                            <p className="text-slate-500 font-medium">
                                {myTasks.length === 0
                                    ? 'Tasks assigned to you by others will appear here.'
                                    : 'Try changing your filters or date range.'}
                            </p>
                            {activeFilterCount > 0 && (
                                <button onClick={handleClearFilters} className="mt-4 px-4 py-2 bg-[#137fec] text-white rounded-lg text-sm font-bold hover:bg-[#106bc7] transition-all shadow-sm active:scale-95">
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    ) : viewMode === 'List' ? (
                        sortedTasks.map((task) => (
                            <div
                                key={`${task.recordSource}_${task.id}`}
                                className={`premium-card premium-card-hover border-border-main p-0.5 ${expandedTasks.has(task.id) ? 'ring-4 ring-primary/10' : ''}`}
                            >
                                <div
                                    className="p-4 flex items-center gap-4 cursor-pointer"
                                    onClick={() => toggleTaskExpansion(task.id)}
                                >
                                    <input type="checkbox" className="w-5 h-5 rounded border-slate-300 accent-[#137fec]" onClick={e => e.stopPropagation()} />

                                    {/* Assigner avatar */}
                                    <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold relative shrink-0"
                                        title={`Assigned by ${task.assignerFirstName || ''} ${task.assignerLastName || ''}`}>
                                        <div className="absolute inset-0 rounded-full border-2 border-purple-300 dark:border-purple-800 opacity-60" />
                                        {`${task.assignerFirstName?.[0] || ''}${task.assignerLastName?.[0] || ''}`.toUpperCase() || '?'}
                                    </div>

                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-xs font-bold text-slate-400 whitespace-nowrap hidden sm:block">
                                                From: {task.assignerFirstName} {task.assignerLastName}
                                            </span>
                                            <span className="text-base font-black text-text-main truncate">{task.taskTitle}</span>
                                            <div className="flex items-center gap-1 ml-1 scale-75 origin-left shrink-0">
                                                {task.voiceNoteUrl && <Mic size={14} className="text-blue-500" strokeWidth={3} />}
                                                {task.referenceDocs && <Paperclip size={14} className="text-orange-500" strokeWidth={3} />}
                                            </div>
                                        </div>
                                        <div className="ml-auto flex items-center gap-3 shrink-0">
                                            {/* Status badge */}
                                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase border whitespace-nowrap hidden md:inline-flex ${task.status === 'Completed' ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' :
                                                    task.status === 'In Progress' ? 'bg-orange-50 dark:bg-orange-900/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800' :
                                                        task.status === 'Overdue' ? 'bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800' :
                                                            task.status === 'Hold' ? 'bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800' :
                                                                'bg-bg-main text-text-muted border-slate-200 dark:border-slate-700'
                                                }`}>{task.status}</span>

                                            {/* Due date */}
                                            {task.dueDate && (
                                                <span className={`text-[11px] font-bold whitespace-nowrap hidden md:block ${new Date(task.dueDate) < new Date() && task.status !== 'Completed' ? 'text-red-500' : 'text-slate-400'}`}>
                                                    📅 {new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                </span>
                                            )}

                                            {task.priority && (
                                                <span className={`text-[10px] font-black hidden md:block ${task.priority === 'Urgent' ? 'text-red-500' :
                                                        task.priority === 'High' ? 'text-orange-500' :
                                                            task.priority === 'Medium' ? 'text-blue-500' : 'text-slate-400'
                                                    }`}>● {task.priority}</span>
                                            )}

                                            <span className="text-[11px] font-black text-slate-400 whitespace-nowrap">{formatTimeAgo(task.createdAt)}</span>

                                            <button
                                                onClick={(e) => { e.stopPropagation(); setSelectedTaskId(task.id); setShowDetails(true); }}
                                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-[#137fec] dark:hover:text-blue-400 transition-all"
                                                title="View Details"
                                            >
                                                <MoreVertical size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded */}
                                {expandedTasks.has(task.id) && (
                                    <div className="px-6 pb-5 pt-2 border-t border-slate-50 dark:border-slate-800 animate-in slide-in-from-top-2 duration-300 space-y-3">
                                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-bold text-slate-400 pt-2">
                                            <div className="flex items-center gap-1.5 text-text-muted">
                                                <Clock size={14} className="text-red-400" />
                                                Due: {task.dueDate
                                                    ? new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                                    : 'No date set'}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <User size={14} className="text-purple-400" />
                                                Assigned by: <span className="text-slate-600 dark:text-slate-300">{task.assignerFirstName} {task.assignerLastName}</span>
                                            </div>
                                            {task.category && (
                                                <div className="flex items-center gap-1.5">
                                                    <Folder size={14} className="text-slate-400" />
                                                    {task.category}
                                                </div>
                                            )}
                                            {task.priority && (
                                                <div className={`flex items-center gap-1.5 ${task.priority === 'Urgent' ? 'text-red-500' : task.priority === 'High' ? 'text-orange-500' : 'text-text-muted'}`}>
                                                    <Flag size={14} fill="currentColor" />
                                                    {task.priority}
                                                </div>
                                            )}
                                        </div>

                                        {/* Description snippet */}
                                        {task.description && (
                                            <p className="text-xs text-text-muted font-medium leading-relaxed line-clamp-2 border-l-2 border-[#137fec]/30 pl-3">
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
                                                className="flex items-center gap-1.5 px-4 py-2 bg-[#137fec]/10 dark:bg-blue-900/10 hover:bg-[#137fec]/20 dark:hover:bg-blue-900/20 text-[#137fec] dark:text-blue-400 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all"
                                            >
                                                <CheckSquare size={14} strokeWidth={3} />
                                                Update Status
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : viewMode === 'Kanban' ? (
                        <TaskKanbanView tasks={sortedTasks} onTaskClick={(task) => { setSelectedTaskId(task.id); setShowDetails(true); }} />
                    ) : (
                        <TaskCalendarView tasks={sortedTasks} onTaskClick={(task) => { setSelectedTaskId(task.id); setShowDetails(true); }} />
                    )}
                </div>

                <TaskDetailsDrawer
                    isOpen={showDetails}
                    taskId={selectedTaskId}
                    onClose={() => setShowDetails(false)}
                    onSuccess={fetchAllData}
                />

                <TaskCreationForm
                    isOpen={showDelegationDrawer}
                    isMyTask={true}
                    onClose={() => setShowDelegationDrawer(false)}
                    onSuccess={fetchAllData}
                />
            </div>
        </MainLayout>
    );
};

export default MyTasks;



