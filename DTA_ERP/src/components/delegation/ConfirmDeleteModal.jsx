import React from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';

const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm, title = "Confirm Delete", message, loading }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div 
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" 
                onClick={onClose} 
            />
            
            <div className="relative w-full max-w-sm bg-bg-card rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-red-500/10">
                <div className="bg-red-500/5 px-4.5 py-3 flex items-center justify-between border-b border-red-500/10">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/20">
                            <AlertTriangle size={16} />
                        </div>
                        <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">{title}</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-red-500/10 rounded-full transition-colors text-slate-300 hover:text-red-500">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-4.5 space-y-4">
                    <p className="text-[11px] text-text-muted font-bold leading-normal text-center italic px-2">
                        {message}
                    </p>

                    <div className="flex gap-2.5 pt-1">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="flex-1 py-2 text-[10px] font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-bg-main rounded-lg transition-all"
                        >
                            CANCEL
                        </button>
                        <button 
                            type="button"
                            onClick={onConfirm}
                            disabled={loading}
                            className="flex-[1.5] py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-500/10 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {loading ? (
                                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Trash2 size={14} />
                                    CONFIRM DELETE
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDeleteModal;



