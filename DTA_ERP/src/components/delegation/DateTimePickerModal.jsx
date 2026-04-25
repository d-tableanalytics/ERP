import React, { useState } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addDays, setHours, setMinutes, getHours, getMinutes } from "date-fns";

const DateTimePickerModal = ({ isOpen, onClose, value, onChange }) => {
  const [activeTab, setActiveTab] = useState("date"); // "date" or "time"
  const [currentMonth, setCurrentMonth] = useState(value ? new Date(value) : new Date());
  
  // Internal state for selected date and time
  const [selectedDate, setSelectedDate] = useState(value ? new Date(value) : new Date());
  
  const handleDateSelect = (date) => {
    const newDate = new Date(selectedDate);
    newDate.setFullYear(date.getFullYear());
    newDate.setMonth(date.getMonth());
    newDate.setDate(date.getDate());
    setSelectedDate(newDate);
  };

  const handleTimeChange = (type, action) => {
    const newDate = new Date(selectedDate);
    let hours = getHours(newDate);
    let minutes = getMinutes(newDate);

    if (type === "hour") {
      hours = action === "inc" ? (hours + 1) % 24 : (hours - 1 + 24) % 24;
    } else {
      minutes = action === "inc" ? (minutes + 1) % 60 : (minutes - 1 + 60) % 60;
    }

    newDate.setHours(hours);
    newDate.setMinutes(minutes);
    setSelectedDate(newDate);
  };

  const toggleAMPM = () => {
    const newDate = new Date(selectedDate);
    let hours = getHours(newDate);
    if (hours >= 12) {
      hours -= 12;
    } else {
      hours += 12;
    }
    newDate.setHours(hours);
    setSelectedDate(newDate);
  };

  const handleDone = () => {
    onChange(selectedDate.toISOString());
  };

  if (!isOpen) return null;

  // Calendar logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const hour24 = getHours(selectedDate);
  const isPM = hour24 >= 12;
  const hour12 = hour24 % 12 || 12;
  const mins = getMinutes(selectedDate);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-bg-card w-full max-w-[400px] rounded-[32px] shadow-2xl overflow-hidden border border-border-main flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-b border-slate-50">
           <h3 className="text-[13px] font-black text-[#137fec] uppercase tracking-widest">Select Due Date</h3>
           <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors">
              <span className="material-symbols-outlined text-xl">close</span>
           </button>
        </div>

        {/* Tabs */}
        <div className="px-8 pt-4">
           <div className="bg-bg-main p-1.5 rounded-2xl flex items-center gap-1">
              <button 
                onClick={() => setActiveTab("date")}
                className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'date' ? 'bg-bg-card text-[#137fec] shadow-sm shadow-blue-500/10' : 'text-text-muted hover:text-text-main'}`}
              >
                Date
              </button>
              <button 
                onClick={() => setActiveTab("time")}
                className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'time' ? 'bg-bg-card text-[#137fec] shadow-sm shadow-blue-500/10' : 'text-text-muted hover:text-text-main'}`}
              >
                Time
              </button>
           </div>
        </div>

        <div className="p-8">
           {activeTab === "date" ? (
             <div className="space-y-6">
                {/* Month Navigator */}
                <div className="flex items-center justify-between">
                   <div className="bg-blue-50/50 px-5 py-2.5 rounded-xl border border-blue-100/50">
                      <span className="text-[13px] font-black text-[#137fec] uppercase tracking-widest">
                         {format(currentMonth, "MMMM yyyy")}
                      </span>
                   </div>
                   <div className="flex items-center gap-2">
                      <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="size-9 rounded-xl border border-border-main bg-bg-main flex items-center justify-center text-text-muted hover:text-[#137fec] transition-all">
                         <span className="material-symbols-outlined text-xl">chevron_left</span>
                      </button>
                      <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="size-9 rounded-xl border border-border-main bg-bg-main flex items-center justify-center text-text-muted hover:text-[#137fec] transition-all">
                         <span className="material-symbols-outlined text-xl">chevron_right</span>
                      </button>
                   </div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-y-2">
                   {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                     <div key={day} className="text-[10px] font-black text-text-muted uppercase text-center pb-2">{day}</div>
                   ))}
                   {calendarDays.map((day, i) => {
                     const isSelected = isSameDay(day, selectedDate);
                     const isCurrentMonth = isSameMonth(day, currentMonth);
                     return (
                       <button
                         key={i}
                         onClick={() => handleDateSelect(day)}
                         className={`size-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all mx-auto
                           ${isSelected ? 'bg-[#137fec] text-white shadow-lg shadow-blue-500/20' : 
                             isCurrentMonth ? 'text-text-main hover:bg-bg-main hover:text-[#137fec]' : 'text-text-muted'}`}
                       >
                         {format(day, "d")}
                       </button>
                     );
                   })}
                </div>
             </div>
           ) : (
             <div className="flex flex-col items-center justify-center py-4 space-y-8">
                <div className="flex items-center gap-4">
                   {/* Hours */}
                   <div className="flex flex-col items-center gap-3">
                      <button onClick={() => handleTimeChange("hour", "inc")} className="text-text-muted hover:text-[#137fec] transition-colors">
                         <span className="material-symbols-outlined text-2xl">expand_less</span>
                      </button>
                      <div className="size-16 bg-bg-main border-2 border-border-main rounded-2xl flex items-center justify-center text-3xl font-black text-text-main shadow-sm">
                         {hour12.toString().padStart(2, '0')}
                      </div>
                      <button onClick={() => handleTimeChange("hour", "dec")} className="text-text-muted hover:text-[#137fec] transition-colors">
                         <span className="material-symbols-outlined text-2xl">expand_more</span>
                      </button>
                   </div>

                   <div className="text-3xl font-black text-border-main pb-1">:</div>

                   {/* Minutes */}
                   <div className="flex flex-col items-center gap-3">
                      <button onClick={() => handleTimeChange("min", "inc")} className="text-text-muted hover:text-[#137fec] transition-colors">
                         <span className="material-symbols-outlined text-2xl">expand_less</span>
                      </button>
                      <div className="size-16 bg-bg-main border-2 border-border-main rounded-2xl flex items-center justify-center text-3xl font-black text-text-main shadow-sm">
                         {mins.toString().padStart(2, '0')}
                      </div>
                      <button onClick={() => handleTimeChange("min", "dec")} className="text-text-muted hover:text-[#137fec] transition-colors">
                         <span className="material-symbols-outlined text-2xl">expand_more</span>
                      </button>
                   </div>

                   {/* AM/PM Toggle */}
                   <div className="flex flex-col gap-2 ml-2">
                      <button 
                        onClick={() => isPM && toggleAMPM()}
                        className={`px-4 py-2 text-[11px] font-black rounded-xl border transition-all ${!isPM ? 'bg-[#137fec] border-[#137fec] text-white shadow-lg shadow-blue-500/20' : 'bg-bg-main border-border-main text-text-muted'}`}
                      >
                        AM
                      </button>
                      <button 
                        onClick={() => !isPM && toggleAMPM()}
                        className={`px-4 py-2 text-[11px] font-black rounded-xl border transition-all ${isPM ? 'bg-[#137fec] border-[#137fec] text-white shadow-lg shadow-blue-500/20' : 'bg-bg-main border-border-main text-text-muted'}`}
                      >
                        PM
                      </button>
                   </div>
                </div>
             </div>
           )}
        </div>

        {/* Actions */}
        <div className="p-6 flex items-center justify-center gap-4 bg-slate-50/30">
           <button 
             onClick={onClose}
             className="flex-1 py-4 text-[12px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
           >
              Cancel
           </button>
           <button 
             onClick={handleDone}
             className="flex-[1.5] py-4 bg-[#137fec] hover:bg-[#0D6AD1] text-white rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-200 active:scale-95 flex items-center justify-center gap-2"
           >
              <span className="material-symbols-outlined text-lg">save</span>
              Done
           </button>
        </div>

      </div>
    </div>
  );
};

export default DateTimePickerModal;
