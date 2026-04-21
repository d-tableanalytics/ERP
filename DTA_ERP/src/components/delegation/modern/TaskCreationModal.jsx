import React from 'react';
import { X, CheckSquare, Save } from 'lucide-react';

const TaskCreationModal = ({ isOpen, onClose, onManualCreate, onTemplateCreate }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/40"
            />
            
            {/* Modal Content */}
            <div className="relative w-full max-w-[400px] bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-700 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
                    <h2 className="text-[10px] font-bold text-white uppercase tracking-widest opacity-70">Assign Task</h2>
                    <button 
                        onClick={onClose}
                        className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Options Layout */}
                <div className="p-3 grid grid-cols-2 gap-3">
                    {/* Option 1: Assign New Task Manually */}
                    <button 
                        onClick={() => {
                            onClose();
                            onManualCreate?.();
                        }}
                        className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border border-emerald-500/20 bg-slate-800 hover:bg-slate-800/80 hover:border-emerald-500/50 transition-all group"
                    >
                        <div className="text-emerald-500">
                            <CheckSquare size={24} />
                        </div>
                        <span className="text-center font-bold text-white text-[10px] uppercase tracking-tight">
                            Assign New Task<br/>Manually
                        </span>
                    </button>

                    {/* Option 2: Use Task Templates */}
                    <button 
                        className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border border-emerald-500/20 bg-slate-800 hover:bg-slate-800/80 hover:border-emerald-500/50 transition-all group"
                        onClick={() => {
                            onClose();
                            onTemplateCreate?.();
                        }}
                    >
                        <div className="text-emerald-500">
                            <Save size={24} />
                        </div>
                        <span className="text-center font-bold text-white text-[10px] uppercase tracking-tight">
                            Use Task<br/>Templates
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TaskCreationModal;
