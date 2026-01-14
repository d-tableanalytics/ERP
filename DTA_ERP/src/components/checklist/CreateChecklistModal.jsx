import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';

const CreateChecklistModal = ({ isOpen, onClose, onSuccess }) => {
    const { token } = useSelector((state) => state.auth);
    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);

    // Form State
    const [formData, setFormData] = useState({
        task: '',
        assignee_id: '',
        assignee_name: '',
        doer_id: '',
        doer_name: '',
        department: '',
        priority: 'medium',
        frequency: 'daily',
        start_date: '',
        verification_required: false,
        attachment_required: false
    });

    // UI State
    const [assigneeSearch, setAssigneeSearch] = useState('');
    const [doerSearch, setDoerSearch] = useState('');
    const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
    const [isDoerDropdownOpen, setIsDoerDropdownOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [fetchError, setFetchError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            fetchInitialData();
            // Reset form
            setFormData({
                task: '',
                assignee_id: '',
                assignee_name: '',
                doer_id: '',
                doer_name: '',
                department: '',
                priority: 'medium',
                frequency: 'daily',
                start_date: '',
                verification_required: false,
                attachment_required: false
            });
        }
    }, [isOpen]);

    const fetchInitialData = async () => {
        setIsLoadingData(true);
        setFetchError(null);
        try {
            if (!token) throw new Error('Authentication token missing');

            const [empRes, deptRes] = await Promise.all([
                axios.get('http://localhost:5000/api/master/employees', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('http://localhost:5000/api/master/departments', { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setEmployees(empRes.data);
            setDepartments(deptRes.data);
        } catch (error) {
            console.error('Error fetching checklist data:', error);
            setFetchError('Failed to load data');
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Mock submission for now since backend endpoint doesn't exist
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log('Checklist Created:', formData);
            onSuccess(); // Refresh table
            onClose();
        } catch (error) {
            console.error('Error creating checklist:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filter helpers
    const filterEmployees = (search) => employees.filter(emp =>
        `${emp.First_Name} ${emp.Last_Name}`.toLowerCase().includes(search.toLowerCase()) ||
        emp.email.toLowerCase().includes(search.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-bg-card border border-yellow-500/30 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden animate-in zoom-in-95 duration-300">

                {/* Header - Yellow Theme */}
                <div className="px-6 py-4 border-b border-yellow-500/20 bg-yellow-500 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg bg-black/10 text-black flex items-center justify-center">
                            <span className="material-symbols-outlined text-xl">check_box</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-black tracking-tight leading-tight">Add New Checklist</h2>
                            <p className="text-[10px] text-black/70 font-bold uppercase tracking-wider">Tasks will be automatically generated based on frequency</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="size-8 rounded-full hover:bg-black/10 text-black/60 hover:text-black transition-all flex items-center justify-center">
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">

                    {/* Question/Task */}
                    <div>
                        <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.15em] mb-2 px-1">Question/Task *</label>
                        <textarea
                            required
                            rows="3"
                            placeholder="Enter the task or question..."
                            className="w-full bg-bg-main border border-border-main rounded-2xl p-4 text-sm text-text-main font-medium focus:outline-none focus:ring-2 focus:ring-yellow-500/50 resize-none leading-relaxed"
                            value={formData.task}
                            onChange={(e) => setFormData({ ...formData, task: e.target.value })}
                        />
                    </div>

                    {/* Row: Assignee, Doer, Department */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                        {/* Assignee */}
                        <div className="relative group">
                            <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.15em] mb-2 px-1">Assignee *</label>
                            <div
                                className="bg-bg-main rounded-2xl p-3 flex items-center justify-between cursor-pointer border border-border-main hover:border-yellow-500/50 transition-all"
                                onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
                            >
                                <span className={`truncate text-sm font-bold ${formData.assignee_name ? 'text-text-main' : 'text-text-muted'}`}>
                                    {formData.assignee_name || 'Search assignee...'}
                                </span>
                                <span className="material-symbols-outlined text-text-muted text-[18px]">expand_more</span>
                            </div>

                            {isAssigneeDropdownOpen && (
                                <div className="absolute z-50 w-full mt-2 bg-bg-card border border-border-main rounded-xl shadow-xl p-2 flex flex-col max-h-48">
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder="Search..."
                                        className="w-full bg-bg-main border border-border-main rounded-lg px-3 py-1.5 text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                                        value={assigneeSearch}
                                        onChange={(e) => setAssigneeSearch(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <div className="overflow-y-auto custom-scrollbar flex-1 min-h-0">
                                        {filterEmployees(assigneeSearch).map(emp => (
                                            <div
                                                key={emp.id}
                                                className="p-2 hover:bg-bg-main rounded-lg cursor-pointer flex items-center gap-2 text-xs"
                                                onClick={() => {
                                                    setFormData({ ...formData, assignee_id: emp.id, assignee_name: `${emp.First_Name} ${emp.Last_Name}` });
                                                    setIsAssigneeDropdownOpen(false);
                                                }}
                                            >
                                                <div className="size-6 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center font-bold text-[8px] uppercase">{emp.First_Name[0]}</div>
                                                <span className="text-text-main font-medium">{emp.First_Name} {emp.Last_Name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Doer */}
                        <div className="relative group">
                            <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.15em] mb-2 px-1">Doer</label>
                            <div
                                className="bg-bg-main rounded-2xl p-3 flex items-center justify-between cursor-pointer border border-border-main hover:border-yellow-500/50 transition-all"
                                onClick={() => setIsDoerDropdownOpen(!isDoerDropdownOpen)}
                            >
                                <span className={`truncate text-sm font-bold ${formData.doer_name ? 'text-text-main' : 'text-text-muted'}`}>
                                    {formData.doer_name || 'Search doer...'}
                                </span>
                                <span className="material-symbols-outlined text-text-muted text-[18px]">expand_more</span>
                            </div>

                            {isDoerDropdownOpen && (
                                <div className="absolute z-50 w-full mt-2 bg-bg-card border border-border-main rounded-xl shadow-xl p-2 flex flex-col max-h-48">
                                    <input
                                        type="text"
                                        autoFocus
                                        placeholder="Search..."
                                        className="w-full bg-bg-main border border-border-main rounded-lg px-3 py-1.5 text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                                        value={doerSearch}
                                        onChange={(e) => setDoerSearch(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <div className="overflow-y-auto custom-scrollbar flex-1 min-h-0">
                                        {filterEmployees(doerSearch).map(emp => (
                                            <div
                                                key={emp.id}
                                                className="p-2 hover:bg-bg-main rounded-lg cursor-pointer flex items-center gap-2 text-xs"
                                                onClick={() => {
                                                    setFormData({ ...formData, doer_id: emp.id, doer_name: `${emp.First_Name} ${emp.Last_Name}` });
                                                    setIsDoerDropdownOpen(false);
                                                }}
                                            >
                                                <div className="size-6 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-[8px] uppercase">{emp.First_Name[0]}</div>
                                                <span className="text-text-main font-medium">{emp.First_Name} {emp.Last_Name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Department */}
                        <div>
                            <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.15em] mb-2 px-1">Department</label>
                            <select
                                className="w-full bg-bg-main border border-border-main rounded-2xl p-3 text-sm text-text-main font-bold focus:outline-none focus:ring-2 focus:ring-yellow-500/50 appearance-none cursor-pointer hover:border-yellow-500/50 transition-all"
                                value={formData.department}
                                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                            >
                                <option value="">Search department...</option>
                                {departments.map(dept => (
                                    <option key={dept.id} value={dept.name}>{dept.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Priority */}
                    <div>
                        <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.15em] mb-2 px-1">Priority *</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['High', 'Medium', 'Low'].map(p => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, priority: p.toLowerCase() })}
                                    className={`py-3 rounded-xl border font-bold text-sm transition-all ${formData.priority === p.toLowerCase()
                                            ? p === 'High' ? 'bg-bg-card border-red-500 text-red-500 shadow-[0_0_15px_-3px_rgba(239,68,68,0.3)]'
                                                : p === 'Medium' ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20' // Matched reference blue
                                                    : 'bg-bg-card border-green-500 text-green-500 shadow-[0_0_15px_-3px_rgba(34,197,94,0.3)]'
                                            : 'bg-bg-main/50 border-transparent text-text-muted hover:bg-bg-main'
                                        }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Frequency */}
                    <div>
                        <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.15em] mb-2 px-1">Frequency *</label>
                        <div className="grid grid-cols-5 gap-2">
                            {['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'].map(f => (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, frequency: f.toLowerCase() })}
                                    className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${formData.frequency === f.toLowerCase()
                                            ? 'bg-yellow-400 text-black border-yellow-400 shadow-lg shadow-yellow-400/20'
                                            : 'bg-bg-main/50 border-transparent text-text-muted hover:bg-bg-main hover:text-text-main'
                                        }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.15em] mb-2 px-1">From Date & Time *</label>
                        <input
                            type="datetime-local"
                            required
                            className="w-full bg-orange-50/5 border border-border-main rounded-xl p-3 text-sm text-text-main font-bold focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                            value={formData.start_date}
                            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        />
                    </div>

                    {/* Toggles */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-orange-50/5 border border-border-main rounded-2xl p-4 flex items-center justify-between">
                            <span className="text-xs font-bold text-text-muted">✓ Verification Required</span>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, verification_required: !formData.verification_required })}
                                className={`w-12 h-6 rounded-full relative transition-colors ${formData.verification_required ? 'bg-yellow-500' : 'bg-bg-main border border-border-main'}`}
                            >
                                <div className={`size-4 rounded-full bg-white absolute top-1 transition-all ${formData.verification_required ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>
                        <div className="bg-orange-50/5 border border-border-main rounded-2xl p-4 flex items-center justify-between">
                            <span className="text-xs font-bold text-text-muted">📎 Task Attachment Required</span>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, attachment_required: !formData.attachment_required })}
                                className={`w-12 h-6 rounded-full relative transition-colors ${formData.attachment_required ? 'bg-yellow-500' : 'bg-bg-main border border-border-main'}`}
                            >
                                <div className={`size-4 rounded-full bg-white absolute top-1 transition-all ${formData.attachment_required ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>
                    </div>

                </form>

                {/* Footer */}
                <div className="px-6 py-5 border-t border-border-main bg-bg-main/30 flex gap-4 shrink-0">
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex-1 py-3.5 rounded-xl bg-yellow-500 text-black text-[12px] font-black uppercase tracking-widest shadow-xl shadow-yellow-500/20 transition-all hover:brightness-110 active:scale-95 flex items-center justify-center"
                    >
                        {isSubmitting ? 'Creating...' : 'Create Checklist'}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-32 py-3.5 rounded-xl bg-bg-main/50 text-text-muted border border-border-main text-[12px] font-black uppercase tracking-widest hover:bg-bg-main hover:text-text-main transition-all"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateChecklistModal;
