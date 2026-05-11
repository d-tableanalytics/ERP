import React, { useState, useEffect } from 'react';
import { 
    X, AlignLeft, Flag, CheckSquare, Paperclip, 
    Mic, Plus, ChevronDown, Search, Trash2, 
    Clock, Tag, AlertCircle, ChevronLeft, RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import taskTemplateService from '../../services/taskTemplateService';
import delegationService from '../../services/delegationService';

const TaskTemplateForm = ({ isOpen, onClose, onSuccess, template }) => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: '',
        priority: 'Medium',
        frequency: 'Once',
        checklistItems: []
    });

    const [categories, setCategories] = useState([]);
    const [isLoadingCategories, setIsLoadingCategories] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Checklist state
    const [newChecklistItem, setNewChecklistItem] = useState('');
    const [showChecklist, setShowChecklist] = useState(false);

    // Dropdowns
    const [activeDropdown, setActiveDropdown] = useState(null); // 'category', 'priority', 'frequency'

    useEffect(() => {
        if (isOpen) {
            fetchCategories();
            if (template) {
                setFormData({
                    title: template.title || '',
                    description: template.description || '',
                    category: template.category || '',
                    priority: template.priority || 'Medium',
                    frequency: template.frequency || 'Once',
                    checklistItems: template.checklistItems || []
                });
            } else {
                setFormData({
                    title: '',
                    description: '',
                    category: '',
                    priority: 'Medium',
                    frequency: 'Once',
                    checklistItems: []
                });
            }
        }
    }, [isOpen, template]);

    const fetchCategories = async () => {
        try {
            setIsLoadingCategories(true);
            const res = await delegationService.getCategories();
            setCategories(res.data || res || []);
        } catch (err) {
            console.error('Error fetching categories:', err);
        } finally {
            setIsLoadingCategories(false);
        }
    };

    const handleAddChecklistItem = () => {
        if (!newChecklistItem.trim()) return;
        setFormData(prev => ({
            ...prev,
            checklistItems: [...prev.checklistItems, { text: newChecklistItem.trim(), completed: false }]
        }));
        setNewChecklistItem('');
    };

    const handleRemoveChecklistItem = (index) => {
        setFormData(prev => ({
            ...prev,
            checklistItems: prev.checklistItems.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            toast.error('Template title is required');
            return;
        }

        try {
            setIsSubmitting(true);
            const user = JSON.parse(localStorage.getItem('user'));
            const userId = user?.user?.id || user?.id;

            const payload = {
                ...formData,
                createdBy: userId
            };

            if (template) {
                await taskTemplateService.updateTemplate(template.id, payload);
                toast.success('Template updated successfully');
            } else {
                await taskTemplateService.createTemplate(payload);
                toast.success('Template created successfully');
            }
            onSuccess();
            onClose();
        } catch (err) {
            console.error('Error saving template:', err);
            toast.error('Failed to save template');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="p-2 hover:bg-white rounded-lg transition-all">
                            <ChevronLeft size={20} className="text-slate-600" />
                        </button>
                        <h2 className="text-lg font-black text-slate-800">{template ? 'Edit' : 'Create'} Task Template</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-lg transition-all text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    {/* Title */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Add Title</label>
                        <input 
                            type="text"
                            placeholder="Template Title..."
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full text-xl font-black text-slate-800 placeholder:text-slate-300 border-none focus:ring-0 p-1 bg-transparent"
                            autoFocus
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Add Description</label>
                        <div className="flex gap-3">
                            <AlignLeft size={18} className="text-slate-300 mt-2 shrink-0" />
                            <textarea 
                                placeholder="Write details about the task..."
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                className="w-full min-h-[100px] text-sm font-medium text-slate-600 placeholder:text-slate-300 border-none focus:ring-0 p-1 bg-transparent resize-none"
                            />
                        </div>
                    </div>

                    {/* Checklist */}
                    <div className="border-t border-slate-50 pt-4">
                        <button 
                            type="button"
                            onClick={() => setShowChecklist(!showChecklist)}
                            className="flex items-center justify-between w-full group"
                        >
                            <span className="flex items-center gap-2 text-sm font-black text-slate-700 uppercase tracking-wider">
                                <Plus size={16} className="text-[#00d094]" />
                                Add Checklist
                            </span>
                            <ChevronDown size={16} className={`text-slate-400 transition-transform ${showChecklist ? 'rotate-180' : ''}`} />
                        </button>

                        {showChecklist && (
                            <div className="mt-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                {formData.checklistItems.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg group">
                                        <CheckSquare size={16} className="text-slate-300" />
                                        <span className="flex-1 text-sm font-bold text-slate-600">{item.text}</span>
                                        <button 
                                            type="button"
                                            onClick={() => handleRemoveChecklistItem(idx)}
                                            className="p-1 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-dashed border-slate-200">
                                    <input 
                                        type="text"
                                        placeholder="Add a point..."
                                        value={newChecklistItem}
                                        onChange={(e) => setNewChecklistItem(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddChecklistItem())}
                                        className="flex-1 bg-transparent border-none text-sm font-bold placeholder:text-slate-300 focus:ring-0 p-0"
                                    />
                                    <button 
                                        type="button"
                                        onClick={handleAddChecklistItem}
                                        className="p-1 text-[#00d094] hover:bg-emerald-50 rounded transition-all"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Meta Fields: Priority & Category */}
                    <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-50">
                        {/* Priority */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setActiveDropdown(activeDropdown === 'priority' ? null : 'priority')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                                    formData.priority === 'Urgent' ? 'bg-red-50 text-red-500 border-red-100' :
                                    formData.priority === 'High' ? 'bg-orange-50 text-orange-500 border-orange-100' :
                                    formData.priority === 'Medium' ? 'bg-blue-50 text-blue-500 border-blue-100' :
                                    'bg-slate-50 text-slate-500 border-slate-100'
                                }`}
                            >
                                <Flag size={14} fill="currentColor" />
                                {formData.priority}
                            </button>
                            
                            {activeDropdown === 'priority' && (
                                <div className="absolute top-full mt-2 left-0 w-40 bg-white border border-slate-100 rounded-xl shadow-xl z-50 p-2 animate-in fade-in zoom-in-95 duration-200">
                                    {['Urgent', 'High', 'Medium', 'Low'].map(p => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => { setFormData(prev => ({ ...prev, priority: p })); setActiveDropdown(null); }}
                                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-600 transition-all text-left"
                                        >
                                            <Flag size={12} fill={p === 'Urgent' ? '#ef4444' : p === 'High' ? '#f97316' : p === 'Medium' ? '#3b82f6' : '#94a3b8'} className={p === 'Urgent' ? 'text-red-500' : p === 'High' ? 'text-orange-500' : p === 'Medium' ? 'text-blue-500' : 'text-slate-400'} />
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Category */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setActiveDropdown(activeDropdown === 'category' ? null : 'category')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                                    formData.category ? 'bg-emerald-50 text-[#00d094] border-[#00d094]/20' : 'bg-slate-50 text-slate-400 border-slate-100'
                                }`}
                            >
                                <Tag size={14} />
                                {formData.category || 'Category'}
                            </button>

                            {activeDropdown === 'category' && (
                                <div className="absolute top-full mt-2 left-0 w-64 bg-white border border-slate-100 rounded-xl shadow-xl z-50 p-3 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="relative mb-2">
                                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input 
                                            type="text"
                                            placeholder="Search category..."
                                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border-none rounded-lg text-xs font-bold focus:ring-0"
                                            onClick={e => e.stopPropagation()}
                                        />
                                    </div>
                                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                        {categories.map(c => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => { setFormData(prev => ({ ...prev, category: c.name })); setActiveDropdown(null); }}
                                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-600 transition-all text-left"
                                            >
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                                                {c.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Frequency */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setActiveDropdown(activeDropdown === 'frequency' ? null : 'frequency')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                                    formData.frequency ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                                }`}
                            >
                                <RotateCcw size={14} />
                                {formData.frequency || 'Frequency'}
                            </button>

                            {activeDropdown === 'frequency' && (
                                <div className="absolute top-full mt-2 left-0 w-40 bg-white border border-slate-100 rounded-xl shadow-xl z-50 p-2 animate-in fade-in zoom-in-95 duration-200">
                                    {['Once', 'Daily', 'Weekly', 'Monthly'].map(f => (
                                        <button
                                            key={f}
                                            type="button"
                                            onClick={() => { setFormData(prev => ({ ...prev, frequency: f })); setActiveDropdown(null); }}
                                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-600 transition-all text-left"
                                        >
                                            <RotateCcw size={12} className="text-purple-400" />
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button type="button" className="p-2 text-slate-400 hover:text-[#00d094] hover:bg-white rounded-lg transition-all">
                            <Paperclip size={20} />
                        </button>
                        <button type="button" className="p-2 text-slate-400 hover:text-[#00d094] hover:bg-white rounded-lg transition-all">
                            <Clock size={20} />
                        </button>
                        <button type="button" className="p-2 text-slate-400 hover:text-[#00d094] hover:bg-white rounded-lg transition-all">
                            <Mic size={20} />
                        </button>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !formData.title.trim()}
                        className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-sm transition-all shadow-sm ${
                            isSubmitting || !formData.title.trim()
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-[#00d094] hover:bg-[#00ba84] text-white active:scale-95'
                        }`}
                    >
                        {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Plus size={18} strokeWidth={3} />
                        )}
                        {template ? 'Update Template' : 'Add Template'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TaskTemplateForm;



