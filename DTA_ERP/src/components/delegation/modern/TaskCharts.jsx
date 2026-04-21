import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const COLORS = {
    pending: '#f59e0b', // Amber/Orange
    overdue: '#ef4444', // Red
    inProgress: '#fbbf24', // Yellow
    completed: '#10b981', // Emerald/Green
};

const DonutChart = ({ data, title }) => {
    const size = 120;
    const strokeWidth = 20;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const center = size / 2;

    const total = data.reduce((acc, item) => acc + item.value, 0);
    let cumulativeValue = 0;

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-sm flex flex-col md:flex-row items-center gap-6 flex-1 min-w-[300px]">
            <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4">{title}</h3>
                <div className="relative w-[120px] h-[120px]">
                    <svg width={size} height={size} className="transform -rotate-90">
                        <circle
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="transparent"
                            stroke="currentColor"
                            strokeWidth={strokeWidth}
                            className="text-slate-100 dark:text-slate-800"
                        />
                        {total > 0 ? (
                            data.map((item, index) => {
                                const percentage = (item.value / total) * 100;
                                const strokeDasharray = (percentage / 100) * circumference;
                                const strokeDashoffset = (cumulativeValue / total) * circumference;
                                cumulativeValue += item.value;
                                return (
                                    <circle
                                        key={index}
                                        cx={center}
                                        cy={center}
                                        r={radius}
                                        fill="transparent"
                                        stroke={item.color}
                                        strokeWidth={strokeWidth}
                                        strokeDasharray={`${strokeDasharray} ${circumference}`}
                                        strokeDashoffset={-strokeDashoffset}
                                        className="transition-all duration-700 ease-out"
                                    />
                                );
                            })
                        ) : (
                            <circle
                                cx={center}
                                cy={center}
                                r={radius}
                                fill="transparent"
                                stroke="#94a3b8"
                                strokeWidth={strokeWidth}
                                className="opacity-50"
                            />
                        )}
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-full" />
                    </div>
                </div>
            </div>

            <div className="space-y-3 min-w-[140px]">
                {data.map((item, index) => {
                    const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
                    return (
                        <div key={index} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                {item.label} - {item.value} ({percentage}%)
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const StackedBarChart = ({ data, title, xLabel }) => {
    const itemsPerPage = 6;
    const [currentPage, setCurrentPage] = useState(0);
    const totalPages = Math.ceil(data.length / itemsPerPage);
    const paginatedData = data.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

    const chartHeight = 220;
    const chartWidth = 500;
    const barWidth = 12;
    const gap = (chartWidth - (paginatedData.length * barWidth)) / (paginatedData.length + 1);

    const maxValue = Math.max(5, ...data.map(d => d.pending + d.overdue + d.inProgress + d.completed));
    const yAxisTicks = [0, Math.ceil(maxValue / 4), Math.ceil(maxValue / 2), Math.ceil((maxValue * 3) / 4), maxValue];

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm flex flex-col h-full min-h-[400px]">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-tight">{title}</h3>
                <div className="flex gap-4">
                    {['pending', 'overdue', 'inProgress', 'completed'].map(key => (
                        <div key={key} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[key] }} />
                            <span className="text-[10px] font-bold text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 relative mt-4">
                {/* Y Axis Legend */}
                <div className="absolute left-0 top-0 bottom-20 flex flex-col justify-between text-[10px] font-black text-slate-400">
                    {[...yAxisTicks].reverse().map(tick => <span key={tick}>{tick}</span>)}
                </div>

                {/* Grid Lines */}
                <div className="absolute left-8 right-0 top-0 bottom-20 flex flex-col justify-between pointer-events-none">
                    {yAxisTicks.map((_, i) => (
                        <div key={i} className="w-full border-t border-slate-100 dark:border-slate-800 h-0" />
                    ))}
                </div>

                {/* Bars Area */}
                <div className="absolute left-8 right-0 top-0 bottom-20 flex items-end">
                    {paginatedData.map((d, i) => {
                        const total = d.pending + d.overdue + d.inProgress + d.completed;
                        return (
                            <div key={i} className="flex flex-col items-center justify-end h-full" style={{ width: `${100 / paginatedData.length}%` }}>
                                {total > 0 ? (
                                    <div className="flex flex-col-reverse w-4 rounded-t-full overflow-hidden transition-all duration-700 bg-slate-50 dark:bg-slate-800/50" 
                                         style={{ height: `${(total / maxValue) * 100}%` }}>
                                        <div className="w-full hover:brightness-110 transition-all" style={{ height: `${(d.pending / total) * 100}%`, backgroundColor: COLORS.pending }} title={`Pending: ${d.pending}`} />
                                        <div className="w-full hover:brightness-110 transition-all" style={{ height: `${(d.overdue / total) * 100}%`, backgroundColor: COLORS.overdue }} title={`Overdue: ${d.overdue}`} />
                                        <div className="w-full hover:brightness-110 transition-all" style={{ height: `${(d.inProgress / total) * 100}%`, backgroundColor: COLORS.inProgress }} title={`In Progress: ${d.inProgress}`} />
                                        <div className="w-full hover:brightness-110 transition-all" style={{ height: `${(d.completed / total) * 100}%`, backgroundColor: COLORS.completed }} title={`Completed: ${d.completed}`} />
                                    </div>
                                ) : (
                                    <div className="w-4 h-0" />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Label Area (Below the zero line) */}
                <div className="absolute left-8 right-0 bottom-6 h-12 flex items-start">
                    {paginatedData.map((d, i) => (
                        <div key={i} className="flex flex-col items-center text-center px-1" style={{ width: `${100 / paginatedData.length}%` }}>
                            <div className="text-[10px] font-extrabold text-slate-700 dark:text-slate-200 whitespace-nowrap overflow-hidden text-ellipsis max-w-full leading-tight" title={d.label}>
                                {d.label}
                            </div>
                            {d.sublabel && (
                                <div className="text-[8px] font-bold text-slate-400 capitalize mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                                    {d.sublabel}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* X Axis Title */}
                <div className="absolute bottom-0 left-0 right-0 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{xLabel}</div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-6">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(0, p - 1))} 
                        disabled={currentPage === 0}
                        className="p-1 rounded-full text-slate-400 hover:text-emerald-500 disabled:opacity-30 transition-colors"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-[10px] font-bold text-slate-500">{currentPage + 1} of {totalPages}</span>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} 
                        disabled={currentPage === totalPages - 1}
                        className="p-1 rounded-full text-slate-400 hover:text-emerald-500 disabled:opacity-30 transition-colors"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );
};

const TaskCharts = ({ tasks = [], users = [], groups = [], currentUserId, type = 'all' }) => {
    // Basic aggregation
    const overdueCount = tasks.filter(t => t.status === 'Overdue').length;
    const pendingCount = tasks.filter(t => t.status === 'Pending').length;
    const inProgressCount = tasks.filter(t => t.status === 'In Progress').length;
    const completedCount = tasks.filter(t => t.status === 'Completed').length;

    const donutData1 = [
        { label: 'Overdue', value: overdueCount, color: COLORS.overdue },
        { label: 'Pending', value: pendingCount, color: COLORS.pending },
        { label: 'In Progress', value: inProgressCount, color: COLORS.inProgress },
    ];

    const notCompletedCount = tasks.length - completedCount;
    const donutData2 = [
        { label: 'Completed', value: completedCount, color: COLORS.completed },
        { label: 'Not Completed', value: notCompletedCount, color: COLORS.overdue },
    ];

    const now = new Date();
    const delayedCount = tasks.filter(t => t.status !== 'Completed' && t.dueDate && new Date(t.dueDate) < now).length;
    const inTimeCount = tasks.length - delayedCount;
    const donutData3 = [
        { label: 'In-Time', value: inTimeCount, color: COLORS.completed },
        { label: 'Delayed', value: delayedCount, color: '#94a3b8' },
    ];

    if (type === 'donuts') {
        return (
            <div className="flex flex-wrap gap-4 animate-in fade-in duration-500">
                <DonutChart title="Overdue, Pending & In-Progress" data={donutData1} />
                <DonutChart title="Completed & Not Completed" data={donutData2} />
                <DonutChart title="In-Time & Delayed" data={donutData3} />
            </div>
        );
    }

    // --- Data Grouping for Bar Charts ---

    const getUserName = (id) => {
        const u = users.find(u => u.userId === id || u.id === id);
        return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : 'Unknown';
    };

    const getGroupName = (id) => {
        const g = groups.find(g => g.groupId === id || g.id === id);
        return g ? g.name : 'Unknown Group';
    };

    const groupTasks = (taskList, keyFn, labelFn, sublabelFn) => {
        const map = {};
        taskList.forEach(t => {
            const key = keyFn(t);
            if (!key) return;
            if (!map[key]) {
                map[key] = { label: labelFn(t), sublabel: sublabelFn ? sublabelFn(t) : '', pending: 0, overdue: 0, inProgress: 0, completed: 0 };
            }
            const s = t.status;
            if (s === 'Pending') map[key].pending++;
            else if (s === 'Overdue') map[key].overdue++;
            else if (s === 'In Progress') map[key].inProgress++;
            else if (s === 'Completed') map[key].completed++;
        });
        return Object.values(map);
    };

    const employeeData = groupTasks(
        tasks,
        t => t.doerId,
        t => getUserName(t.doerId),
        t => users.find(u => u.userId === t.doerId || u.id === t.doerId)?.designation || ''
    );

    const categoryData = groupTasks(
        tasks,
        t => t.category || 'Uncategorized',
        t => t.category || 'Uncategorized'
    );

    const dailyData = groupTasks(
        tasks,
        t => new Date(t.createdAt).toLocaleDateString('en-CA'),
        t => new Date(t.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    ).sort((a, b) => a.label.localeCompare(b.label));

    const monthlyData = groupTasks(
        tasks,
        t => { const d = new Date(t.createdAt); return `${d.getFullYear()}-${d.getMonth() + 1}`; },
        t => new Date(t.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    );

    const delegatedData = groupTasks(
        tasks.filter(t => t.assignerId === currentUserId),
        t => t.doerId,
        t => getUserName(t.doerId)
    );

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-500">
            <StackedBarChart title="Employee Wise" data={employeeData} xLabel="Employee Name" />
            <StackedBarChart title="Category Wise" data={categoryData} xLabel="Category Name" />
            <StackedBarChart title="Daily Report" data={dailyData} xLabel="Date" />
            <StackedBarChart title="Monthly Report" data={monthlyData} xLabel="Month" />
            <StackedBarChart title="Delegated Tasks Report" data={delegatedData} xLabel="Assigned To" />
        </div>
    );
};

export default TaskCharts;

