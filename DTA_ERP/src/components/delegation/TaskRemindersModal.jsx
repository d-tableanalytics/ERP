import React, { useState, useEffect } from 'react';
import { X, Plus, Save, Bell, Smartphone, MessageCircle, Mail } from 'lucide-react';

const TaskRemindersModal = ({ isOpen, onClose, onSave, initialReminders = [] }) => {
    const [reminders, setReminders] = useState([
        { type: 'whatsapp', timeValue: 10, timeUnit: 'minutes', triggerType: 'before' }
    ]);

    useEffect(() => {
        if (initialReminders && initialReminders.length > 0) {
            setReminders(initialReminders);
        } else {
            setReminders([{ type: 'whatsapp', timeValue: 10, timeUnit: 'minutes', triggerType: 'before' }]);
        }
    }, [initialReminders, isOpen]);

    if (!isOpen) return null;

    const addReminder = () => {
        setReminders([...reminders, { type: 'whatsapp', timeValue: 10, timeUnit: 'minutes', triggerType: 'before' }]);
    };

    const updateReminder = (index, updates) => {
        const newReminders = [...reminders];
        newReminders[index] = { ...newReminders[index], ...updates };
        setReminders(newReminders);
    };

    const removeReminder = (index) => {
        if (reminders.length === 1) return;
        setReminders(reminders.filter((_, i) => i !== index));
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
            <div className="w-full max-w-sm bg-bg-card rounded-2xl shadow-2xl border border-border-main overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-4.5 py-3 flex items-center justify-between border-b border-border-main bg-bg-card">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[#137fec]/10 text-[#137fec] flex items-center justify-center">
                            <Bell size={16} />
                        </div>
                        <h2 className="text-sm font-black text-text-main uppercase tracking-tight">Task Reminders</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-300 hover:text-[#137fec]">
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4.5 space-y-3.5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {reminders.map((reminder, index) => (
                        <div key={index} className="relative bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-border-main space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-6 h-6 rounded-lg bg-[#137fec] text-white flex items-center justify-center font-black text-[10px] shadow-lg shadow-[#137fec]/10">
                                        {index + 1}
                                    </div>
                                    <span className="font-black text-text-muted uppercase tracking-widest text-[10px]">Reminder {index + 1}</span>
                                </div>
                                <div className="flex bg-bg-card p-1 rounded-lg border border-border-main">
                                    {[
                                        { id: 'whatsapp', icon: MessageCircle, label: 'WHATSAPP' },
                                        { id: 'email', icon: Mail, label: 'EMAIL' },
                                        { id: 'both', icon: Smartphone, label: 'BOTH' }
                                    ].map((type) => (
                                        <button
                                            key={type.id}
                                            onClick={() => updateReminder(index, { type: type.id })}
                                            className={`px-2 py-1 rounded-md text-[9px] font-black transition-all flex items-center gap-1.5 ${
                                                reminder.type === type.id 
                                                ? 'bg-bg-main text-[#137fec] shadow-sm' 
                                                : 'text-slate-400 opacity-50 hover:opacity-100'
                                            }`}
                                        >
                                            <type.icon size={12} />
                                            {type.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5">
                                <div className="w-16">
                                    <input 
                                        type="number"
                                        value={reminder.timeValue}
                                        onChange={(e) => updateReminder(index, { timeValue: e.target.value })}
                                        className="w-full bg-bg-card border border-border-main rounded-lg p-2 font-black text-center text-[11px] focus:ring-4 focus:ring-[#137fec]/5 focus:border-[#137fec]/30 outline-none transition-all text-text-main"
                                        
                                    />
                                </div>
                                <div className="flex-1">
                                    <select 
                                        value={reminder.timeUnit}
                                        onChange={(e) => updateReminder(index, { timeUnit: e.target.value })}
                                        className="w-full bg-bg-card border border-border-main rounded-lg p-2 font-black text-[10px] appearance-none cursor-pointer focus:ring-4 focus:ring-[#137fec]/5 focus:border-[#137fec]/30 outline-none text-center transition-all text-text-main"
                                        
                                    >
                                        <option value="minutes" className="bg-bg-card text-text-main">MINUTES</option>
                                        <option value="hours" className="bg-bg-card text-text-main">HOURS</option>
                                        <option value="days" className="bg-bg-card text-text-main">DAYS</option>
                                    </select>
                                </div>
                                <div className="flex bg-bg-card p-1 rounded-lg border border-border-main gap-1">
                                    {['before', 'after'].map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => updateReminder(index, { triggerType: type })}
                                            className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase transition-all flex items-center gap-1.5 ${
                                                reminder.triggerType === type 
                                                ? 'text-[#137fec]' 
                                                : 'text-slate-400 opacity-50'
                                            }`}
                                        >
                                            <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                                                reminder.triggerType === type ? 'border-[#137fec]' : 'border-slate-300 dark:border-slate-700'
                                            }`}>
                                                {reminder.triggerType === type && <div className="w-1.5 h-1.5 rounded-full bg-[#137fec]" />}
                                            </div>
                                            {type}
                                        </button>
                                    ))}
                                </div>
                                {reminders.length > 1 && (
                                    <button 
                                        onClick={() => removeReminder(index)}
                                        className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border-main flex items-center gap-2.5 bg-slate-50 dark:bg-slate-950/50">
                    <button 
                        onClick={addReminder}
                        className="flex-1 py-2 rounded-lg border-2 border-dashed border-border-main text-slate-400 font-black uppercase tracking-widest text-[9px] hover:border-[#137fec] hover:text-[#137fec] transition-all flex items-center justify-center gap-2"
                    >
                        <Plus size={14} />
                        ADD REMINDER
                    </button>
                    <button 
                        onClick={() => onSave(reminders)}
                        className="flex-1.5 py-2 rounded-lg bg-[#137fec] text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-[#137fec]/10 hover:bg-[#106bc7] transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                        <Save size={14} />
                        SAVE ALL
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TaskRemindersModal;



