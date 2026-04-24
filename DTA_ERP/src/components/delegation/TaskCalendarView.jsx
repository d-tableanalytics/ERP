import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Clock, Plus, Paperclip, Mic } from 'lucide-react';

const TaskCalendarView = ({ tasks, onTaskClick }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewType, setViewType] = useState('Week'); // 'Day', 'Week', 'Month'

    // Helper to get start of week (Sunday)
    const getStartOfWeek = (date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday start
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    };

    const startOfWeek = useMemo(() => {
        const start = getStartOfWeek(currentDate);
        return start;
    }, [currentDate]);

    const weekDays = useMemo(() => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            days.push(d);
        }
        return days;
    }, [startOfWeek]);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const formatDateRange = () => {
        if (viewType === 'Week') {
            const endOfWeek = new Date(weekDays[6]);
            return `${monthNames[startOfWeek.getMonth()]} ${startOfWeek.getDate()} - ${monthNames[endOfWeek.getMonth()]} ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
        }
        if (viewType === 'Day') {
            return `${monthNames[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
        }
        return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    };

    const navigate = (direction) => {
        const newDate = new Date(currentDate);
        if (viewType === 'Week') {
            newDate.setDate(currentDate.getDate() + (direction * 7));
        } else if (viewType === 'Day') {
            newDate.setDate(currentDate.getDate() + direction);
        } else {
            newDate.setMonth(currentDate.getMonth() + direction);
        }
        setCurrentDate(newDate);
    };

    const hours = Array.from({ length: 15 }, (_, i) => i + 8); // 8 AM to 10 PM

    const formatHour = (hour) => {
        const period = hour >= 12 ? 'pm' : 'am';
        const h = hour > 12 ? hour - 12 : hour;
        return `${h} ${period}`;
    };

    const isToday = (date) => {
        const today = new Date();
        return date.getDate() === today.getDate() && 
               date.getMonth() === today.getMonth() && 
               date.getFullYear() === today.getFullYear();
    };

    const getTasksForDay = (day, hour = null) => {
        return tasks.filter(t => {
            const dateStr = t.dueDate || t.createdAt;
            if (!dateStr) return false;
            const d = new Date(dateStr);
            const isSameDay = d.getDate() === day.getDate() && 
                             d.getMonth() === day.getMonth() && 
                             d.getFullYear() === day.getFullYear();
            
            if (!isSameDay) return false;
            
            if (hour === null) {
                if (!t.dueDate) return true; // Show in All Day if no exact due date
                const h = d.getHours();
                return h === 0 || h < 8 || h > 22; // All Day if outside grid
            }
            if (!t.dueDate) return false;
            return d.getHours() === hour;
        });
    };

    const displayDays = viewType === 'Day' ? [currentDate] : weekDays;

    return (
        <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 animate-in fade-in duration-500 overflow-hidden">
            {/* Top Bar */}
            <div className="flex items-center justify-between">
                <div className="flex items-center bg-slate-50 dark:bg-slate-950/50 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                    {['Day', 'Week', 'Month'].map(type => (
                        <button
                            key={type}
                            onClick={() => setViewType(type)}
                            className={`px-6 py-2 rounded-lg text-sm font-black transition-all ${viewType === type ? 'bg-white dark:bg-slate-800 text-[#137fec] shadow-sm border border-slate-200 dark:border-slate-700' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
                <button 
                    onClick={() => setCurrentDate(new Date())}
                    className="px-6 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95"
                >
                    Today
                </button>
            </div>

            {/* Navigation Bar */}
            <div className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800/50">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors active:scale-95">
                    <ChevronLeft size={20} strokeWidth={3} />
                </button>
                <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">{formatDateRange()}</h2>
                <button onClick={() => navigate(1)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors active:scale-95">
                    <ChevronRight size={20} strokeWidth={3} />
                </button>
            </div>

            {viewType === 'Month' ? (
                <div className="grid grid-cols-7 gap-px bg-slate-100 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                        <div key={d} className="bg-slate-50 dark:bg-slate-900 py-3 text-center text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{d}</div>
                    ))}
                    {Array.from({ length: 35 }).map((_, i) => {
                        const day = new Date(startOfWeek);
                        day.setDate(startOfWeek.getDate() + i);
                        const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                        const dayTasks = tasks.filter(t => {
                            const dateStr = t.dueDate || t.createdAt;
                            if (!dateStr) return false;
                            const d = new Date(dateStr);
                            return d.getDate() === day.getDate() && 
                                   d.getMonth() === day.getMonth() && 
                                   d.getFullYear() === day.getFullYear();
                        });

                        return (
                            <div key={i} className={`min-h-[100px] p-2 bg-white dark:bg-slate-900 ${!isCurrentMonth ? 'opacity-30' : ''} hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-all relative`}>
                                <span className={`text-xs font-black ${isToday(day) ? 'bg-[#137fec] text-white w-6 h-6 flex items-center justify-center rounded-full shadow-lg shadow-blue-500/20' : 'text-slate-400 dark:text-slate-500'}`}>
                                    {day.getDate()}
                                </span>
                                <div className="mt-1 space-y-1">
                                    {dayTasks.slice(0, 3).map((t, idx) => (
                                        <div 
                                            key={t.id || idx} 
                                            onClick={() => onTaskClick?.(t)}
                                            className="text-[9px] font-bold bg-[#137fec]/10 text-[#137fec] dark:text-blue-400 px-1.5 py-0.5 rounded border border-[#137fec]/20 dark:border-blue-900/30 truncate cursor-pointer hover:bg-[#137fec]/20 dark:hover:bg-blue-900/40 transition-colors flex items-center gap-1"
                                        >
                                            {(t.voiceNoteUrl || t.referenceDocs) && <div className="flex gap-0.5"><Paperclip size={6} strokeWidth={3} /></div>}
                                            {t.taskTitle}
                                        </div>
                                    ))}
                                    {dayTasks.length > 3 && (
                                        <div className="text-[8px] font-black text-slate-400 dark:text-slate-500 pl-1">+{dayTasks.length - 3} more</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="flex flex-col flex-1 overflow-hidden border border-slate-100 dark:border-slate-800 rounded-xl">
                    {/* Header */}
                    <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                        <div className="w-20 shrink-0 border-r border-slate-100 dark:border-slate-800 flex items-center justify-center">
                            <Clock size={14} className="text-slate-400" />
                        </div>
                        <div className={`flex-1 grid ${viewType === 'Week' ? 'grid-cols-7' : 'grid-cols-1'} divide-x divide-slate-100 dark:divide-slate-800`}>
                            {displayDays.map((day, i) => (
                                <div key={i} className="py-4 flex flex-col items-center gap-1 relative">
                                    <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][viewType === 'Week' ? i : day.getDay() === 0 ? 6 : day.getDay() - 1]}
                                    </span>
                                    <span className={`text-sm font-black ${isToday(day) ? 'text-[#137fec]' : 'text-slate-600 dark:text-slate-400'}`}>
                                        {day.getDate()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* All Day Section */}
                    <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20">
                        <div className="w-20 shrink-0 border-r border-slate-100 dark:border-slate-800 py-2 px-3 text-right">
                            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">All Day</span>
                        </div>
                        <div className={`flex-1 grid ${viewType === 'Week' ? 'grid-cols-7' : 'grid-cols-1'} divide-x divide-slate-100 dark:divide-slate-800`}>
                            {displayDays.map((day, i) => (
                                <div key={i} className="p-1 min-h-[40px] flex flex-wrap gap-1">
                                    {getTasksForDay(day, null).map((task, idx) => (
                                        <div 
                                            key={task.id || idx} 
                                            onClick={() => onTaskClick?.(task)}
                                            className="bg-[#137fec]/10 dark:bg-blue-900/20 border border-[#137fec]/20 dark:border-blue-800/30 rounded-md px-2 py-1 flex-1 min-w-[60px] max-w-full cursor-pointer hover:bg-[#137fec]/20 dark:hover:bg-blue-900/40 transition-colors flex items-center justify-between gap-2 shadow-sm"
                                        >
                                            <p className="text-[10px] font-bold text-[#137fec] dark:text-blue-400 truncate">{task.taskTitle}</p>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {task.voiceNoteUrl && <Mic size={8} className="text-[#137fec]" />}
                                                {task.referenceDocs && <Paperclip size={8} className="text-orange-500" />}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Hourly Grid */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {hours.map(hour => (
                            <div key={hour} className="flex min-h-[60px] border-b border-slate-50 dark:border-slate-800/30">
                                <div className="w-20 shrink-0 border-r border-slate-100 dark:border-slate-800 py-2 pr-3 text-right">
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                                        {formatHour(hour)}
                                    </span>
                                </div>
                                <div className={`flex-1 grid ${viewType === 'Week' ? 'grid-cols-7' : 'grid-cols-1'} divide-x divide-slate-50 dark:divide-slate-800/30`}>
                                    {displayDays.map((day, i) => (
                                        <div key={i} className="relative group hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors min-h-[60px]">
                                            {getTasksForDay(day, hour).map((task, idx) => (
                                                <div 
                                                    key={task.id || idx} 
                                                    onClick={() => onTaskClick?.(task)}
                                                    className="absolute inset-1 bg-white dark:bg-slate-800 border-l-4 border-l-[#137fec] shadow-sm hover:shadow-md cursor-pointer rounded p-1.5 z-10 overflow-hidden transition-all"
                                                >
                                                    <p className="text-[10px] font-bold text-slate-800 dark:text-slate-100 truncate">{task.taskTitle}</p>
                                                    <div className="flex items-center justify-between mt-0.5">
                                                        <div className="flex items-center gap-1 text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase">
                                                            <Clock size={8} /> {formatHour(hour)}
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            {task.voiceNoteUrl && <Mic size={8} className="text-[#137fec]" />}
                                                            {task.referenceDocs && <Paperclip size={8} className="text-orange-500" />}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskCalendarView;
