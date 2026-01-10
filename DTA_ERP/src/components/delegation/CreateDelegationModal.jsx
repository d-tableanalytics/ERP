import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';

const CreateDelegationModal = ({ isOpen, onClose, onSuccess }) => {
    const { token, user } = useSelector((state) => state.auth);
    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [formData, setFormData] = useState({
        delegation_name: '',
        description: '',
        doer_id: '',
        doer_name: '',
        department: '',
        priority: 'medium',
        due_date: '',
        evidence_required: true
    });

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Audio State
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);

    // Files
    const [files, setFiles] = useState([]);

    useEffect(() => {
        if (isOpen) {
            fetchInitialData();
        }
    }, [isOpen]);

    const fetchInitialData = async () => {
        try {
            const [empRes, deptRes] = await Promise.all([
                axios.get('http://localhost:5000/api/master/employees', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('http://localhost:5000/api/master/departments', { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setEmployees(empRes.data);
            setDepartments(deptRes.data);
        } catch (error) {
            console.error('Error fetching modal data:', error);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Could not start recording', err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };

    const handleRemoveAudio = () => {
        setAudioBlob(null);
        setAudioUrl(null);
        chunksRef.current = [];
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const data = new FormData();
        Object.keys(formData).forEach(key => data.append(key, formData[key]));
        data.append('delegator_id', user.id);
        data.append('delegator_name', user.name);

        if (audioBlob) {
            data.append('voice_note', audioBlob, 'voice-note.webm');
        }

        files.forEach(file => {
            data.append('reference_docs', file);
        });

        try {
            await axios.post('http://localhost:5000/api/delegations', data, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error creating delegation:', error);
            alert('Failed to create delegation');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredEmployees = employees.filter(emp =>
        `${emp.First_Name} ${emp.Last_Name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-black/60 backdrop-blur-sm">
            <div className="bg-bg-card border border-border-main w-full max-w-3xl rounded-4xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-border-main flex justify-between items-center bg-bg-main/20 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                            <span className="material-symbols-outlined text-2xl">add_task</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-text-main tracking-tight leading-tight">Initiate Delegation</h2>
                            <p className="text-[10px] text-text-muted font-medium uppercase tracking-wider">Configure task objectives</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="size-8 rounded-full hover:bg-bg-main text-text-muted transition-all flex items-center justify-center">
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 md:p-7 overflow-y-auto custom-scrollbar flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-7">

                        {/* Row 1: Receiver, Delegated By, Department */}
                        <div className="md:col-span-4 relative group">
                            <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.15em] mb-2 px-1">Receiver (Doer Name)</label>
                            <div
                                className="bg-bg-main rounded-2xl p-3 flex items-center justify-between cursor-pointer border border-border-main focus-within:ring-2 focus-within:ring-primary/20 transition-all hover:border-primary/40"
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className="material-symbols-outlined text-[18px] text-text-muted shrink-0">person</span>
                                    <span className={`truncate text-sm font-bold ${formData.doer_name ? 'text-text-main' : 'text-text-muted'}`}>
                                        {formData.doer_name || 'Assign team...'}
                                    </span>
                                </div>
                                <span className={`material-symbols-outlined text-text-muted text-[18px] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
                            </div>

                            {isDropdownOpen && (
                                <div className="absolute z-100 w-full mt-2 bg-bg-card border border-border-main rounded-2xl shadow-2xl p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="relative mb-2">
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm pointer-events-none">search</span>
                                        <input
                                            type="text"
                                            autoFocus
                                            placeholder="Search team..."
                                            className="w-full bg-bg-main border border-border-main rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                    <div className="max-h-52 overflow-y-auto custom-scrollbar space-y-0.5">
                                        {filteredEmployees.map(emp => (
                                            <div
                                                key={emp.id}
                                                className="p-2 hover:bg-bg-main rounded-xl cursor-pointer flex items-center gap-3 transition-colors group/item"
                                                onClick={() => {
                                                    setFormData({ ...formData, doer_id: emp.id, doer_name: `${emp.First_Name} ${emp.Last_Name}` });
                                                    setIsDropdownOpen(false);
                                                }}
                                            >
                                                <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                                                    {emp.First_Name.charAt(0)}
                                                </div>
                                                <div className="overflow-hidden">
                                                    <p className="text-xs font-bold text-text-main group-hover/item:text-primary transition-colors truncate">{emp.First_Name} {emp.Last_Name}</p>
                                                    <p className="text-[10px] text-text-muted truncate">{emp.email}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="md:col-span-4">
                            <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.15em] mb-2 px-1">Delegated By</label>
                            <div className="bg-bg-main/50 border border-border-main rounded-[1rem] p-3 text-sm font-bold text-text-muted/60 flex items-center gap-2 cursor-not-allowed">
                                <span className="material-symbols-outlined text-[18px]">verified</span>
                                <span className="truncate">{user?.name || 'Authorized'}</span>
                            </div>
                        </div>

                        <div className="md:col-span-4">
                            <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.15em] mb-2 px-1">Department</label>
                            <div className="relative">
                                <select
                                    required
                                    className="w-full bg-bg-main border border-border-main rounded-2xl p-3 pl-10 text-sm text-text-main font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none transition-all cursor-pointer"
                                    value={formData.department}
                                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                >
                                    <option value="">Select</option>
                                    {departments.map(dept => (
                                        <option key={dept.id} value={dept.name}>{dept.name}</option>
                                    ))}
                                </select>
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none text-[18px]">corporate_fare</span>
                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none text-[18px]">expand_more</span>
                            </div>
                        </div>

                        {/* Row 2: Deadline, Priority Level */}
                        <div className="md:col-span-6">
                            <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.15em] mb-2 px-1">Deadline (IST)</label>
                            <div className="relative">
                                <input
                                    type="datetime-local"
                                    required
                                    className="w-full bg-bg-main border border-border-main rounded-2xl p-3 pl-10 text-sm text-text-main font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    value={formData.due_date}
                                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                />
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none text-[18px]">event</span>
                            </div>
                        </div>

                        <div className="md:col-span-6">
                            <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.15em] mb-2 px-1">Priority Level</label>
                            <div className="flex gap-1.5 p-1.5 bg-bg-main border border-border-main rounded-2xl">
                                {['low', 'medium', 'high'].map(p => (
                                    <button
                                        key={p}
                                        type="button"
                                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${formData.priority === p
                                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                            : 'text-text-muted hover:text-text-main hover:bg-white/5'
                                            }`}
                                        onClick={() => setFormData({ ...formData, priority: p })}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Row 3: Title, Evidence Required */}
                        <div className="md:col-span-8">
                            <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.15em] mb-2 px-1">Delegation Objective / Title</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    required
                                    placeholder="Enter primary goal..."
                                    className="w-full bg-bg-main border border-border-main rounded-2xl p-3 pl-10 text-sm text-text-main font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    value={formData.delegation_name}
                                    onChange={(e) => setFormData({ ...formData, delegation_name: e.target.value })}
                                />
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none text-[18px]">label</span>
                            </div>
                        </div>

                        <div className="md:col-span-4">
                            <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.15em] mb-2 px-1">Evidence Required?</label>
                            <div className="flex gap-2 p-1.5 bg-bg-main border border-border-main rounded-2xl">
                                <button
                                    type="button"
                                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${formData.evidence_required
                                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                                        : 'text-text-muted hover:text-text-main hover:bg-white/5'
                                        }`}
                                    onClick={() => setFormData({ ...formData, evidence_required: true })}
                                >
                                    Yes
                                </button>
                                <button
                                    type="button"
                                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${!formData.evidence_required
                                        ? 'bg-bg-card text-text-main border border-border-main'
                                        : 'text-text-muted hover:text-text-main hover:bg-white/5'
                                        }`}
                                    onClick={() => setFormData({ ...formData, evidence_required: false })}
                                >
                                    No
                                </button>
                            </div>
                        </div>

                        {/* Row 4: Description */}
                        <div className="md:col-span-12">
                            <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.15em] mb-2 px-1">Detailed Execution Instructions</label>
                            <div className="relative">
                                <textarea
                                    rows="3"
                                    placeholder="Describe requirements and expectations..."
                                    className="w-full bg-bg-main border border-border-main rounded-2xl p-4 pl-10 text-sm text-text-main font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none leading-relaxed"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                                <span className="material-symbols-outlined absolute left-3 top-4 text-text-muted pointer-events-none text-[18px]">description</span>
                            </div>
                        </div>

                        {/* Row 5: Voice Instructions, Reference Materials */}
                        <div className="md:col-span-6 flex flex-col h-full">
                            <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.15em] mb-2 px-1">Voice Briefing</label>
                            <div className="bg-bg-main/20 border border-border-main rounded-3xl p-4 flex flex-col gap-3 justify-center min-h-[140px] flex-1">
                                {!isRecording && !audioUrl ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={startRecording}
                                            className="size-14 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center hover:bg-primary/20 transition-all active:scale-95"
                                        >
                                            <span className="material-symbols-outlined text-2xl">mic</span>
                                        </button>
                                        <span className="text-[9px] font-bold text-text-muted uppercase">Tap to record</span>
                                    </div>
                                ) : isRecording ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="flex gap-1 items-center h-4">
                                            {[...Array(5)].map((_, i) => (
                                                <div key={i} className="w-1 bg-red-400 rounded-full animate-pulse" style={{ height: `${Math.random() * 100}%` }}></div>
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={stopRecording}
                                            className="size-14 rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30 flex items-center justify-center animate-bounce"
                                        >
                                            <span className="material-symbols-outlined text-2xl">stop</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 bg-bg-main rounded-xl p-2 border border-border-main">
                                            <audio src={audioUrl} controls className="h-6 w-full" />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={startRecording}
                                                className="flex-1 py-1.5 rounded-lg bg-bg-main border border-border-main text-[9px] font-black uppercase text-text-main flex items-center justify-center gap-1 hover:bg-white/5 transition-all"
                                            >
                                                <span className="material-symbols-outlined text-xs">refresh</span> Redo
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleRemoveAudio}
                                                className="flex-1 py-1.5 rounded-lg bg-red-50 text-red-500 border border-red-100 text-[9px] font-black uppercase flex items-center justify-center gap-1"
                                            >
                                                <span className="material-symbols-outlined text-xs">delete</span> Drop
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="md:col-span-6 flex flex-col h-full">
                            <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.15em] mb-2 px-1">Reference Docs</label>
                            <div className="border border-dashed border-border-main rounded-3xl p-4 bg-bg-main/10 flex flex-col items-center justify-center group cursor-pointer relative min-h-[140px] flex-1 overflow-hidden">
                                <input
                                    type="file"
                                    multiple
                                    className="absolute inset-0 opacity-0 cursor-pointer z-20"
                                    onChange={(e) => setFiles(Array.from(e.target.files))}
                                />
                                <div className="flex flex-col items-center pointer-events-none group-hover:scale-105 transition-transform duration-300">
                                    <div className="size-12 rounded-2xl bg-bg-main flex items-center justify-center text-text-muted group-hover:text-primary mb-2 shadow-inner">
                                        <span className="material-symbols-outlined text-2xl">cloud_upload</span>
                                    </div>
                                    <span className="text-[11px] font-black text-text-main uppercase tracking-tighter">Add files</span>
                                    <span className="text-[8px] text-text-muted mt-0.5 uppercase tracking-widest">PDF, Images • Max 5</span>
                                </div>
                                {files.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-1 relative z-30">
                                        {files.map((file, i) => (
                                            <div key={i} className="bg-bg-card border border-border-main rounded-lg px-2 py-1 flex items-center gap-2 group/file hover:border-primary/50 transition-all">
                                                <span className="text-[8px] font-bold text-text-main truncate max-w-[80px]">{file.name}</span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFiles(files.filter((_, idx) => idx !== i));
                                                    }}
                                                    className="size-4 rounded-md hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"
                                                >
                                                    <span className="material-symbols-outlined text-[10px]">close</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </form>

                {/* Modal Footer */}
                <div className="px-6 py-5 border-t border-border-main bg-bg-main/20 flex gap-4 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3.5 rounded-xl bg-bg-main text-text-muted text-[10px] font-black uppercase tracking-widest hover:bg-border-main transition-all"
                    >
                        Discard
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex-2 py-3.5 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? <div className="size-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <span className="material-symbols-outlined text-[16px]">bolt</span>}
                        <span>{isSubmitting ? 'Sending...' : 'Authorize Delegation'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateDelegationModal;
