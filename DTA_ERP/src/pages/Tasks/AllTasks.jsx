import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Search, FileUp, List, Layout,
    Calendar as CalendarIcon, ChevronDown, Clock,
    Folder, Flag, User, MoreVertical, CheckSquare, Tag, RotateCcw,
    Filter, X, LayoutGrid, Paperclip, Mic
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
import FilterChip from '../../components/tasks/FilterChip';
import { getDateRangeFilter, calculateTaskStatus, taskMatchesStatus } from '../../utils/taskFilters';
import { formatTimeAgo, formatDate, getStatusBadgeClass, exportTasksToCSV } from '../../utils/formatters';

// ── Date range helper and FilterChip are imported from shared modules ─────────

// ── Main Component ───────────────────────────────────────────────────────────
const AllTasks = () => {
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
    const [assignedTo, setAssignedTo] = useState('All');
    const [assignedBy, setAssignedBy] = useState('All');
    const [departmentFilter, setDepartmentFilter] = useState('All');
    const [showFilters, setShowFilters] = useState(false);
    const [isHighlighted, setIsHighlighted] = useState(false);

    // export modal filter states
    const [exportDateRange, setExportDateRange] = useState('All Time');
    const [exportCustomStart, setExportCustomStart] = useState('');
    const [exportCustomEnd, setExportCustomEnd] = useState('');
    const [exportAssignedTo, setExportAssignedTo] = useState([]);
    const [exportAssignedBy, setExportAssignedBy] = useState([]);
    const [exportCategory, setExportCategory] = useState('All');
    const [exportTaskTypes, setExportTaskTypes] = useState([]);

    const [searchParams] = useSearchParams();

    // UI
    const [viewMode, setViewMode] = useState('List');
    const [expandedTasks, setExpandedTasks] = useState(new Set());
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    const [showTaskDrawer, setShowTaskDrawer] = useState(false);
    const currentRole = useSelector((state) => state.auth.user?.role || state.auth.user?.Role || '');
    const canCreateTask = ['admin', 'superadmin'].includes((currentRole || '').toLowerCase());
    const [showExportModal, setShowExportModal] = useState(false);

    const filterPanelRef = useRef(null);

    useEffect(() => {
        const paramStatus  = searchParams.get('status');
        const paramDoerId  = searchParams.get('doerId');
        const paramDept    = searchParams.get('department');
        const paramCat     = searchParams.get('category');
        const paramHL      = searchParams.get('highlight');

        if (paramStatus)  setStatusFilter(paramStatus);
        if (paramDoerId)  setAssignedTo(paramDoerId);
        if (paramDept)    setDepartmentFilter(paramDept);
        if (paramCat)     setCategory(paramCat);

        if (paramHL === 'true') {
            setIsHighlighted(true);
            const t = setTimeout(() => setIsHighlighted(false), 3000);
            return () => clearTimeout(t);
        }
    }, [searchParams]);

    useEffect(() => { fetchAllData(); }, []);

    useEffect(() => {
        const handler = (e) => {
            if (filterPanelRef.current && !filterPanelRef.current.contains(e.target)) {
                setShowFilters(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (showExportModal) {
            setExportDateRange('All Time');
            setExportCustomStart('');
            setExportCustomEnd('');
            setExportAssignedTo([]);
            setExportAssignedBy([]);
            setExportCategory('All');
            setExportTaskTypes([]);
        }
    }, [showExportModal]);

    const fetchAllData = async () => {
        try {
            setLoading(true);
            const [taskRes, usersRes, catRes] = await Promise.all([
                taskService.getAllTasks(),
                teamService.getUsers(),
                delegationService.getCategories(),
            ]);
            let allTasks = taskRes || [];
            setTasks(allTasks);
            setUsers(Array.isArray(usersRes) ? usersRes : (usersRes.data || []));
            setCategories(catRes.data || catRes || []);

            const deptSet = new Set();
            allTasks.forEach(t => {
                if (t.department) deptSet.add(t.department);
            });
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

    const toggleSelection = (id, list, setter) => {
        if (list.includes(id)) {
            setter(list.filter(x => x !== id));
        } else {
            setter([...list, id]);
        }
    };

    const toggleAll = (list, setter) => {
        if (list.length === users.length) setter([]);
        else setter(users.map(u => u.userId || u.id));
    };

    const handleClearFilters = () => {
        setSearch('');
        setDateRange('All Time');
        setCustomStartDate('');
        setCustomEndDate('');
        setStatusFilter('All');
        setPriority('All');
        setCategory('All');
        setAssignedTo('All');
        setAssignedBy('All');
        setDepartmentFilter('All');
    };

    const exportToCSV = (exportTasks = filteredTasks) => {
        exportTasksToCSV(exportTasks, 'all-tasks', (msg) => toast.error(msg));
        if (exportTasks.length > 0) toast.success(`Exported ${exportTasks.length} task${exportTasks.length !== 1 ? 's' : ''}`);
    };


    const filteredTasks = useMemo(() => tasks.filter(t => {
        if (search && !(t.taskTitle || '').toLowerCase().includes(search.toLowerCase())) return false;
        if (!taskMatchesStatus(t, statusFilter)) return false;
        if (priority !== 'All' && t.priority !== priority) return false;
        if (category !== 'All' && t.category !== category) return false;
        if (assignedTo !== 'All' && t.doerId !== assignedTo) return false;
        if (assignedBy !== 'All' && t.assignerId !== assignedBy) return false;
        if (departmentFilter !== 'All' && t.department !== departmentFilter) return false;
        return getDateRangeFilter(t.dueDate || t.createdAt, dateRange, customStartDate, customEndDate);
    }), [tasks, search, statusFilter, priority, category, assignedTo, assignedBy, departmentFilter, dateRange, customStartDate, customEndDate]);

    const getTasksForExport = (opts) => {
        const { range = 'All Time', start = '', end = '', aTo = [], aBy = [], cat = 'All', types = [] } = opts;
        return tasks.filter(t => {
            if (Array.isArray(aTo) && aTo.length > 0 && !aTo.includes(t.doerId)) return false;
            if (Array.isArray(aBy) && aBy.length > 0 && !aBy.includes(t.assignerId)) return false;
            if (cat !== 'All' && t.category !== cat) return false;
            if (Array.isArray(types) && types.length === 1) {
                const wantRep = types[0] === 'repetitive';
                if (wantRep && !t.isRepeat) return false;
                if (!wantRep && t.isRepeat) return false;
            }
            return getDateRangeFilter(t.dueDate || t.createdAt, range, start, end);
        });
    };

    const getStatusCount = (status) => status === 'All' ? tasks.length : tasks.filter(t => taskMatchesStatus(t, status)).length;
    // formatTimeAgo is imported from shared formatters
    const getUserName = (userId) => {
        const u = users.find(u => u.userId === userId || u.id === userId);
        return u ? `${u.firstName} ${u.lastName}` : 'Unknown';
    };
    const activeFilterCount = [priority !== 'All', category !== 'All', assignedTo !== 'All', assignedBy !== 'All', departmentFilter !== 'All'].filter(Boolean).length;

    const quickStats = useMemo(() => [
        { label: 'Total', value: tasks.length, dot: 'bg-slate-400', bg: 'bg-bg-card', border: 'border-border-main', color: 'text-text-main' },
        { label: 'Overdue', value: getStatusCount('Overdue'), dot: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-900/10', border: 'border-red-100 dark:border-red-900/20', color: 'text-red-600 dark:text-red-400' },
        { label: 'Pending', value: getStatusCount('Pending'), dot: 'border-2 border-slate-400 bg-transparent', bg: 'bg-bg-main', border: 'border-border-main', color: 'text-text-muted' },
        { label: 'In Progress', value: getStatusCount('In Progress'), dot: 'bg-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/10', border: 'border-orange-100 dark:border-orange-900/20', color: 'text-orange-600 dark:text-orange-400' },
        { label: 'Completed', value: getStatusCount('Completed'), dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-100 dark:border-emerald-900/20', color: 'text-emerald-600 dark:text-emerald-400' },
        { label: 'Hold', value: getStatusCount('Hold'), dot: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/10', border: 'border-amber-100 dark:border-amber-900/20', color: 'text-amber-600 dark:text-amber-400' },
        { label: 'Revision', value: getStatusCount('Need Revision'), dot: 'bg-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/10', border: 'border-indigo-100 dark:border-indigo-900/20', color: 'text-indigo-600 dark:text-indigo-400' },
    ], [tasks, statusFilter]);

    return (
        <MainLayout title="All Tasks">
            <div className="animate-in fade-in duration-500">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#137fec] rounded-xl flex items-center justify-center shadow-lg shadow-[#137fec]/30">
                            <LayoutGrid size={22} className="text-white" strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-text-main leading-none">All Tasks</h1>
                            <p className="text-xs font-bold text-slate-400 mt-0.5">Every task across all users</p>
                        </div>
                    </div>
                    {canCreateTask && (
                        <button onClick={() => setShowTaskDrawer(true)} className="flex items-center gap-2 px-5 h-10 bg-[#137fec] hover:bg-[#106bc7] text-white rounded-lg font-bold text-sm transition-all active:scale-95 shadow-sm">
                            <CheckSquare size={16} strokeWidth={3} /> Assign Task
                        </button>
                    )}
                </div>

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

                <div className="flex flex-wrap items-end gap-3 mb-8">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date Range</span>
                        <div className="relative min-w-[140px]">
                            <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="w-full h-11 bg-bg-card border-2 border-primary/20 hover:border-primary/40 rounded-xl pl-3 pr-8 text-sm font-bold text-text-main outline-none appearance-none cursor-pointer shadow-sm transition-all">
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

                    {dateRange === 'Custom' && (
                        <>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase ml-1">Start Date</span>
                                <div className="border border-[#137fec] dark:border-slate-800 rounded-lg h-11 flex items-center px-2.5 gap-1.5 bg-bg-card min-w-[130px]">
                                    <CalendarIcon size={14} className="text-[#137fec] shrink-0" />
                                    <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)}  className="bg-transparent border-none outline-none text-[11px] font-bold text-text-main w-full" />
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase ml-1">End Date</span>
                                <div className="border border-[#137fec] dark:border-slate-800 rounded-lg h-11 flex items-center px-2.5 gap-1.5 bg-bg-card min-w-[130px]">
                                    <CalendarIcon size={14} className="text-[#137fec] shrink-0" />
                                    <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)}  className="bg-transparent border-none outline-none text-[11px] font-bold text-text-main w-full" />
                                </div>
                            </div>
                        </>
                    )}

                    <div className="relative flex flex-col gap-1" ref={filterPanelRef}>
                        <button onClick={() => setShowFilters(v => !v)} className={`flex items-center gap-2 px-5 h-11 rounded-lg font-bold text-sm transition-all shadow-sm ${showFilters ? 'bg-slate-800 dark:bg-slate-700 text-white' : 'bg-[#137fec] hover:bg-[#106bc7] text-white'}`}>
                            <Filter size={18} /> Filter {activeFilterCount > 0 && <span className="bg-white text-[#137fec] text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center border border-white dark:border-slate-700/50 shadow-sm">{activeFilterCount}</span>}
                        </button>
                        {showFilters && (
                            <div className="absolute top-[calc(100%+8px)] left-0 z-50 bg-bg-card border border-border-main rounded-xl shadow-2xl p-4 flex flex-col gap-4 min-w-[240px]">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-text-main uppercase tracking-widest">Filters</span>
                                    <button onClick={handleClearFilters} className="text-[10px] font-bold text-[#137fec] hover:underline">Clear All</button>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase">Assigned To</label>
                                    <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}  className="bg-bg-main border border-border-main p-2 rounded-lg text-xs font-bold outline-none text-text-main">
                                        <option value="All">All Members</option>
                                        {users.map(u => <option key={u.userId || u.id} value={u.userId || u.id}>{u.firstName} {u.lastName}</option>)}
                                    </select>
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

                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type="text" placeholder="Search all tasks..." value={search} onChange={e => setSearch(e.target.value)} className="w-full h-11 pl-10 pr-4 bg-bg-card border border-border-main rounded-lg text-sm font-bold text-text-main outline-none focus:ring-2 focus:ring-blue-500/20" />
                    </div>

                    <button onClick={handleClearFilters} className="h-11 w-11 flex items-center justify-center bg-[#137fec] text-white rounded-lg hover:bg-[#106bc7] transition-all"><RotateCcw size={18} strokeWidth={3} /></button>
                    <button onClick={() => setShowExportModal(true)} className="flex items-center gap-2 px-4 h-11 bg-[#137fec] hover:bg-[#106bc7] text-white rounded-lg font-bold text-sm transition-all"><FileUp size={18} /> Export</button>

                    <div className="flex bg-bg-card rounded-lg p-1 border border-border-main h-11 items-center">
                        {[{ mode: 'List', icon: List }, { mode: 'Kanban', icon: Layout }, { mode: 'Calendar', icon: CalendarIcon }].map(({ mode, icon: Icon }) => (
                            <button key={mode} onClick={() => setViewMode(mode)} className={`p-2 rounded-md transition-all ${viewMode === mode ? 'bg-[#137fec] text-white shadow-sm' : 'text-slate-400 hover:bg-bg-main'}`}>
                                <Icon size={18} />
                            </button>
                        ))}
                    </div>
                </div>

                {showExportModal && (
                    <div onClick={() => setShowExportModal(false)} className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                        <div onClick={e => e.stopPropagation()} className="bg-bg-card border border-white dark:border-slate-800 rounded-lg w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto">
                            <button onClick={() => setShowExportModal(false)} className="absolute top-3 right-3 text-slate-500 hover:text-red-500"><X size={20} /></button>
                            <h2 className="text-lg font-bold mb-4 text-text-main">Export Tasks</h2>
                            <div className="space-y-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase">Date Range</label>
                                    <select value={exportDateRange} onChange={e => setExportDateRange(e.target.value)}  className="bg-bg-main border border-border-main p-2 rounded-lg text-xs font-bold outline-none text-text-main">
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
                                </div>
                                {exportDateRange === 'Custom' && (
                                    <div className="flex gap-2">
                                        <input type="date" value={exportCustomStart} onChange={e => setExportCustomStart(e.target.value)}  className="bg-bg-main border border-border-main p-2 rounded-lg text-xs text-text-main" />
                                        <input type="date" value={exportCustomEnd} onChange={e => setExportCustomEnd(e.target.value)}  className="bg-bg-main border border-border-main p-2 rounded-lg text-xs text-text-main" />
                                    </div>
                                )}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase">Assigned To</label>
                                    <div className="bg-bg-main border border-border-main p-2 rounded-lg text-xs font-bold max-h-32 overflow-y-auto text-text-main">
                                        <div className="flex items-center gap-2 mb-1">
                                            <input type="checkbox" checked={exportAssignedTo.length === users.length} onChange={() => toggleAll(exportAssignedTo, setExportAssignedTo)} />
                                            <span>Select All</span>
                                        </div>
                                        {users.map(u => (
                                            <div key={u.userId || u.id} className="flex items-center gap-2">
                                                <input type="checkbox" checked={exportAssignedTo.includes(u.userId || u.id)} onChange={() => toggleSelection(u.userId || u.id, exportAssignedTo, setExportAssignedTo)} />
                                                <span>{u.firstName} {u.lastName}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase">Assigned By</label>
                                    <div className="bg-bg-main border border-border-main p-2 rounded-lg text-xs font-bold max-h-32 overflow-y-auto text-text-main">
                                        <div className="flex items-center gap-2 mb-1">
                                            <input type="checkbox" checked={exportAssignedBy.length === users.length} onChange={() => toggleAll(exportAssignedBy, setExportAssignedBy)} />
                                            <span>Select All</span>
                                        </div>
                                        {users.map(u => (
                                            <div key={u.userId || u.id} className="flex items-center gap-2">
                                                <input type="checkbox" checked={exportAssignedBy.includes(u.userId || u.id)} onChange={() => toggleSelection(u.userId || u.id, exportAssignedBy, setExportAssignedBy)} />
                                                <span>{u.firstName} {u.lastName}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end mt-6 gap-2">
                                <button onClick={() => { exportToCSV(getTasksForExport({ range: exportDateRange, start: exportCustomStart, end: exportCustomEnd, aTo: exportAssignedTo, aBy: exportAssignedBy, cat: exportCategory, types: exportTaskTypes })); setShowExportModal(false); }} className="px-5 py-2 bg-[#137fec] text-white rounded-lg font-bold hover:bg-[#106bc7] transition-all">Export Tasks</button>
                                <button onClick={() => setShowExportModal(false)} className="px-5 py-2 bg-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-300 transition-all">Cancel</button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-center mb-8 border-b border-border-main relative">
                    <div className="flex gap-6 overflow-x-auto no-scrollbar">
                        {[
                            { label: 'All', dotClass: 'bg-slate-400', key: 'All' },
                            { label: 'Overdue', dotClass: 'bg-red-500', key: 'Overdue' },
                            { label: 'Pending', dotClass: 'border-2 border-slate-400 bg-transparent', key: 'Pending' },
                            { label: 'In Progress', dotClass: 'bg-orange-500', key: 'In Progress' },
                            { label: 'Completed', dotClass: 'bg-[#137fec]', key: 'Completed' },
                            { label: 'Hold', dotClass: 'bg-amber-500', key: 'Hold' },
                            { label: 'Revision', dotClass: 'bg-indigo-500', key: 'Need Revision' },
                        ].map((tab) => (
                            <button key={tab.key} onClick={() => setStatusFilter(tab.key)} className={`flex items-center gap-2 pb-4 px-2 transition-all relative whitespace-nowrap ${statusFilter === tab.key ? 'text-text-main' : 'text-text-muted hover:text-text-main'}`}>
                                <div className={`w-3 h-3 rounded-full shrink-0 ${tab.dotClass} ${statusFilter === tab.key ? 'ring-2 ring-primary/20 shadow-sm' : ''}`} />
                                <span className="text-sm font-bold uppercase tracking-wide">
                                    {tab.label} — <span className={`${statusFilter === tab.key ? 'text-primary dark:text-blue-400 font-black' : 'text-text-muted font-bold'} transition-colors`}>{getStatusCount(tab.key)}</span>
                                </span>
                                {statusFilter === tab.key && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full shadow-[0_-2px_10px_rgba(19,127,236,0.4)]" />}
                            </button>
                        ))}
                    </div>
                </div>

                {activeFilterCount > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4 animate-in slide-in-from-top-2 duration-200">
                        {assignedTo !== 'All' && <FilterChip label={`Assigned To: ${getUserName(assignedTo)}`} onRemove={() => setAssignedTo('All')} />}
                        {assignedBy !== 'All' && <FilterChip label={`Assigned By: ${getUserName(assignedBy)}`} onRemove={() => setAssignedBy('All')} />}
                        {priority !== 'All' && <FilterChip label={`Priority: ${priority}`} onRemove={() => setPriority('All')} />}
                        {category !== 'All' && <FilterChip label={`Category: ${category}`} onRemove={() => setCategory('All')} />}
                        {departmentFilter !== 'All' && <FilterChip label={`Department: ${departmentFilter}`} onRemove={() => setDepartmentFilter('All')} />}
                    </div>
                )}

                <div className="max-w-7xl mx-auto space-y-3 pb-20">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-12 h-12 border-4 border-[#137fec] border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Loading All Tasks...</p>
                        </div>
                    ) : filteredTasks.length === 0 ? (
                        <div className="bg-white/40 border-2 border-dashed border-border-main rounded-3xl p-20 flex flex-col items-center justify-center text-center">
                            <div className="w-20 h-20 bg-bg-main rounded-full flex items-center justify-center mb-6"><CheckSquare size={40} className="text-slate-300" /></div>
                            <h3 className="text-xl font-black text-text-main mb-2">No Tasks Found</h3>
                            <p className="text-slate-500 font-medium">Try changing your filters or date range</p>
                            {activeFilterCount > 0 && <button onClick={handleClearFilters} className="mt-4 px-4 py-2 bg-[#137fec] text-white rounded-lg text-sm font-bold hover:bg-[#106bc7]">Clear Filters</button>}
                        </div>
                    ) : viewMode === 'List' ? (
                        filteredTasks.map((task) => (
                            <div
                            key={`${task.recordSource}_${task.id}`}
                            className={`premium-card premium-card-hover border-border-main p-0.5 ${expandedTasks.has(task.id) ? 'ring-4 ring-primary/10' : ''}`}
                        >
                                {isHighlighted && (
                                    <div className="flex items-center gap-2 px-4 py-1.5 bg-[#137fec]/10 rounded-t-xl border-b border-[#137fec]/20">
                                        <div className="w-2 h-2 bg-[#137fec] rounded-full animate-ping" />
                                        <span className="text-[10px] font-black text-[#137fec] uppercase tracking-widest">From Dashboard Filter</span>
                                    </div>
                                )}
                                <div className="p-4 flex items-center gap-4 cursor-pointer" onClick={() => toggleTaskExpansion(task.id)}>
                                    <input type="checkbox" className="w-5 h-5 rounded border-slate-300 accent-[#137fec]" onClick={e => e.stopPropagation()} />
                                    <div className="w-10 h-10 rounded-full bg-[#137fec]/10 text-[#137fec] flex items-center justify-center font-bold relative shrink-0">
                                        <div className="absolute inset-0 rounded-full border-2 border-[#137fec]/40" />
                                        {`${task.doerFirstName?.[0] || ''}${task.doerLastName?.[0] || ''}`.toUpperCase() || '?'}
                                    </div>
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-base font-black text-text-main truncate">{task.taskTitle}</span>
                                                <div className="flex items-center gap-1.5 scale-75 origin-left shrink-0">
                                                    {task.voiceNoteUrl && <Mic size={14} className="text-blue-500" strokeWidth={3} />}
                                                    {task.referenceDocs && <Paperclip size={14} className="text-orange-500" strokeWidth={3} />}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap hidden sm:block">
                                                    <span className="text-slate-300">By</span> {task.assignerFirstName} {task.assignerLastName}
                                                    <span className="mx-1 text-slate-200">→</span>
                                                    <span className="text-slate-300">To</span> {task.doerFirstName} {task.doerLastName}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="ml-auto flex items-center gap-3 shrink-0">
                                            <span className={getStatusBadgeClass(task.status)}>{task.status}</span>
                                            {task.dueDate && <span className={`text-[11px] font-bold whitespace-nowrap hidden md:block ${new Date(task.dueDate) < new Date() && task.status !== 'Completed' ? 'text-red-500' : 'text-slate-400'}`}>📅 {new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                                            {task.priority && <span className={`text-[10px] font-black hidden md:block ${task.priority === 'Urgent' ? 'text-red-500' : task.priority === 'High' ? 'text-orange-500' : task.priority === 'Medium' ? 'text-blue-500' : 'text-slate-400'}`}>● {task.priority}</span>}
                                            <span className="text-[11px] font-black text-slate-400 whitespace-nowrap">{formatTimeAgo(task.createdAt)}</span>
                                            <button onClick={(e) => { e.stopPropagation(); setSelectedTaskId(task.id); setShowDetails(true); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-[#137fec] transition-all"><MoreVertical size={18} /></button>
                                        </div>
                                    </div>
                                </div>
                                {expandedTasks.has(task.id) && (
                                    <div className="px-6 pb-5 pt-2 border-t border-slate-50 dark:border-slate-800 space-y-3">
                                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-bold text-slate-400 pt-2">
                                            <div className="flex items-center gap-1.5 text-slate-500"><Clock size={14} className="text-red-400" /> Due: {task.dueDate ? new Date(task.dueDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'No date set'}</div>
                                            <div className="flex items-center gap-1.5"><User size={14} className="text-purple-400" /> <span>By: <span className="text-slate-600 dark:text-slate-300">{task.assignerFirstName} {task.assignerLastName}</span></span></div>
                                            <div className="flex items-center gap-1.5"><User size={14} className="text-[#137fec]" /> <span>To: <span className="text-slate-600 dark:text-slate-300">{task.doerFirstName} {task.doerLastName}</span></span></div>
                                            {task.category && <div className="flex items-center gap-1.5"><Folder size={14} className="text-slate-400" /> {task.category}</div>}
                                            {task.priority && <div className={`flex items-center gap-1.5 ${task.priority === 'Urgent' ? 'text-red-500' : task.priority === 'High' ? 'text-orange-500' : 'text-slate-500'}`}><Flag size={14} fill="currentColor" /> {task.priority}</div>}
                                        </div>
                                        {task.description && <p className="text-xs text-text-muted font-medium leading-relaxed line-clamp-2 border-l-2 border-[#137fec]/30 pl-3">{task.description}</p>}
                                        {(() => {
                                            try {
                                                const parsed = typeof task.tags === 'string' ? JSON.parse(task.tags) : (task.tags || []);
                                                if (!Array.isArray(parsed) || parsed.length === 0) return null;
                                                return (
                                                    <div className="flex flex-wrap gap-2">
                                                        {parsed.map((tag, i) => (
                                                            <div key={i} className="flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest" style={{ backgroundColor: `${tag.color}12`, borderColor: `${tag.color}30`, color: tag.color }}>
                                                                <Tag size={10} strokeWidth={3} /> {tag.text}
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            } catch (e) { return null; }
                                        })()}
                                        <div className="pt-1">
                                            <button onClick={(e) => { e.stopPropagation(); setSelectedTaskId(task.id); setShowDetails(true); }} className="flex items-center gap-1.5 px-4 py-2 bg-[#137fec]/10 hover:bg-[#137fec]/20 text-[#137fec] rounded-lg text-[11px] font-black uppercase tracking-widest transition-all"><CheckSquare size={14} strokeWidth={3} /> View Details</button>
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

                <TaskCreationForm isOpen={showTaskDrawer} onClose={() => setShowTaskDrawer(false)} onSuccess={fetchAllData} />
                <TaskDetailsDrawer isOpen={showDetails} taskId={selectedTaskId} onClose={() => setShowDetails(false)} onSuccess={fetchAllData} />
            </div>
        </MainLayout>
    );
};

export default AllTasks;



