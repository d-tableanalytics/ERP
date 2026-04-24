import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, User, AlignLeft, Flag, CheckCircle2, Paperclip, Mic, Loader2 } from 'lucide-react';
import teamService from '../../services/teamService';
import delegationService from '../../services/delegationService';

const CreateDelegationDrawer = ({ isOpen, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        taskName: '',
        description: '',
        assignedDoerId: '',
        category: '',
        priority: 'Medium',
        dueDate: '',
        evidenceRequired: false,
    });

    const [users, setUsers] = useState([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Audio recording state
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [voiceNoteBlob, setVoiceNoteBlob] = useState(null);
    const [voiceNotePreviewUrl, setVoiceNotePreviewUrl] = useState(null);

    // File upload state
    const [selectedFile, setSelectedFile] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            fetchUsers();
            // Reset form when drawer opens
            setFormData({
                taskName: '',
                description: '',
                assignedDoerId: '',
                category: '',
                priority: 'Medium',
                dueDate: '',
                evidenceRequired: false,
            });
            setError(null);
            setVoiceNoteBlob(null);
            if (voiceNotePreviewUrl) URL.revokeObjectURL(voiceNotePreviewUrl);
            setVoiceNotePreviewUrl(null);
            setSelectedFile(null);
        }
    }, [isOpen]);

    const fetchUsers = async () => {
        try {
            setIsLoadingUsers(true);
            const data = await teamService.getUsers();
            setUsers(data);
        } catch (err) {
            console.error('Failed to fetch users:', err);
            setError('Failed to load users for assignment');
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);

            const chunks = [];
            recorder.ondataavailable = (e) => chunks.push(e.data);
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                setVoiceNoteBlob(blob);
                setVoiceNotePreviewUrl(URL.createObjectURL(blob));
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
        } catch (err) {
            console.error('Error accessing microphone:', err);
            setError('Could not access microphone. Please check your permissions.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            setIsRecording(false);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 50 * 1024 * 1024) {
                setError('File size exceeds 50MB limit');
                return;
            }
            setSelectedFile(file);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            setError(null);

            // Get current user for delegatorId (from localStorage or auth state)
            const storedUser = JSON.parse(localStorage.getItem('user'));
            const delegatorId = storedUser?.user?.id || storedUser?.id;

            if (!delegatorId) {
                throw new Error('User not authenticated');
            }

            let voiceNoteUrl = '';
            let referenceDocs = '';

            // 1. Upload voice note if exists
            if (voiceNoteBlob) {
                const voiceFile = new File([voiceNoteBlob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
                const uploadRes = await delegationService.uploadFile(voiceFile, 'voice-notes');
                voiceNoteUrl = uploadRes.url;
            }

            // 2. Upload document if exists
            if (selectedFile) {
                const uploadRes = await delegationService.uploadFile(selectedFile, 'documents');
                referenceDocs = uploadRes.url;
            }

            const submissionData = {
                ...formData,
                assignedDoerId: [formData.assignedDoerId], // Wrap in array for the new backend logic
                inLoopIds: [], // Placeholder since this form doesn't have loop selector yet
                delegatorId,
                status: 'Pending',
                voiceNoteUrl,
                referenceDocs
            };

            await delegationService.createDelegation(submissionData);
            onSuccess();
            onClose();
        } catch (err) {
            console.error('Failed to create delegation:', err);
            setError(err.response?.data?.message || 'Failed to create delegation');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-100 overflow-hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className={`absolute right-0 top-0 h-full w-full max-w-lg bg-(--bg-secondary) shadow-2xl transition-transform duration-300 transform translate-x-0 border-l border-(--border-color)`}>
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="p-6 border-b border-(--border-color) flex items-center justify-between bg-emerald-500 text-white">
                        <div>
                            <h2 className="text-xl font-bold">Delegate New Task</h2>
                            <p className="text-emerald-100 text-sm opacity-90">Assign and track operational work</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Form Content */}
                    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                        {error && (
                            <div className="p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg text-sm font-medium flex items-center gap-2">
                                <X size={16} />
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* Task Name */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-text-main flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-emerald-500" />
                                    Task Name
                                </label>
                                <input
                                    required
                                    type="text"
                                    name="taskName"
                                    value={formData.taskName}
                                    onChange={handleChange}
                                    placeholder="Enter task name..."
                                    className="w-full bg-(--bg-primary) border border-(--border-color) rounded-xl py-2.5 px-4 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-400"
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-text-main flex items-center gap-2">
                                    <AlignLeft size={16} className="text-emerald-500" />
                                    Description
                                </label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    placeholder="Describe the task details..."
                                    rows={4}
                                    className="w-full bg-(--bg-primary) border border-(--border-color) rounded-xl py-2.5 px-4 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-400 resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Doer Selection */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-text-main flex items-center gap-2">
                                        <User size={16} className="text-emerald-500" />
                                        Assing Doer
                                    </label>
                                    <select
                                        required
                                        name="assignedDoerId"
                                        value={formData.assignedDoerId}
                                        onChange={handleChange}
                                        className="w-full bg-(--bg-primary) border border-(--border-color) rounded-xl py-2.5 px-4 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer"
                                    >
                                        <option value="">Select Member</option>
                                        {users.map(u => (
                                            <option key={u.userId} value={u.userId}>
                                                {u.firstName} {u.lastName}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Priority */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-text-main flex items-center gap-2">
                                        <Flag size={16} className="text-emerald-500" />
                                        Priority
                                    </label>
                                    <select
                                        name="priority"
                                        value={formData.priority}
                                        onChange={handleChange}
                                        className="w-full bg-(--bg-primary) border border-(--border-color) rounded-xl py-2.5 px-4 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer"
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                        <option value="Urgent">Urgent</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Department */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-text-main">
                                        Department
                                    </label>
                                    <input
                                        type="text"
                                        name="category"
                                        value={formData.category}
                                        onChange={handleChange}
                                        placeholder="Internal/Sales..."
                                        className="w-full bg-(--bg-primary) border border-(--border-color) rounded-xl py-2.5 px-4 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                    />
                                </div>

                                {/* Due Date */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-text-main flex items-center gap-2">
                                        <Calendar size={16} className="text-emerald-500" />
                                        Due Date
                                    </label>
                                    <input
                                        required
                                        type="date"
                                        name="dueDate"
                                        value={formData.dueDate}
                                        onChange={handleChange}
                                        className="w-full bg-(--bg-primary) border border-(--border-color) rounded-xl py-2.5 px-4 text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Evidence Required */}
                            <div className="flex items-center justify-between p-4 bg-bg-main/30 rounded-xl border border-(--border-color)">
                                <div>
                                    <p className="text-sm font-bold text-text-main">Evidence Required</p>
                                    <p className="text-xs text-slate-500">Requires photo/doc upon completion</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="evidenceRequired"
                                        checked={formData.evidenceRequired}
                                        onChange={handleChange}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                </label>
                            </div>

                            {/* Media Actions */}
                            <div className="flex flex-col gap-2">
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={isRecording ? stopRecording : startRecording}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed transition-all text-sm font-medium ${isRecording
                                                ? 'border-red-500 text-red-500 bg-red-50 animate-pulse'
                                                : voiceNoteBlob
                                                    ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
                                                    : 'border-slate-300 dark:border-slate-700 text-slate-500 hover:border-emerald-500 hover:text-emerald-500'
                                            }`}
                                    >
                                        <Mic size={18} />
                                        {isRecording ? 'Stop Recording' : voiceNoteBlob ? 'Voice Recorded' : 'Voice Note'}
                                    </button>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed transition-all text-sm font-medium ${selectedFile
                                                ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
                                                : 'border-slate-300 dark:border-slate-700 text-slate-500 hover:border-emerald-500 hover:text-emerald-500'
                                            }`}
                                    >
                                        <Paperclip size={18} />
                                        {selectedFile ? 'Doc Selected' : 'Docs'}
                                    </button>
                                </div>

                                {(voiceNotePreviewUrl || selectedFile) && (
                                    <div className="flex flex-col gap-2 p-3 bg-bg-main/50 rounded-xl border border-(--border-color)">
                                        {voiceNotePreviewUrl && (
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <Mic size={14} className="text-emerald-500 flex-shrink-0" />
                                                    <span className="text-xs truncate text-text-muted">Voice Note Preview</span>
                                                </div>
                                                <audio src={voiceNotePreviewUrl} controls className="h-6 w-32" />
                                                <X
                                                    size={14}
                                                    className="text-slate-400 hover:text-red-500 cursor-pointer"
                                                    onClick={() => {
                                                        setVoiceNoteBlob(null);
                                                        setVoiceNotePreviewUrl(null);
                                                    }}
                                                />
                                            </div>
                                        )}
                                        {selectedFile && (
                                            <div className="flex items-center justify-between gap-2 border-t border-(--border-color) pt-2 mt-1 first:border-0 first:pt-0 first:mt-0">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <Paperclip size={14} className="text-emerald-500 flex-shrink-0" />
                                                    <span className="text-xs truncate text-text-muted">{selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                                                </div>
                                                <X
                                                    size={14}
                                                    className="text-slate-400 hover:text-red-500 cursor-pointer"
                                                    onClick={() => setSelectedFile(null)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </form>

                    {/* Footer */}
                    <div className="p-6 border-t border-(--border-color) bg-bg-main/50 flex gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-text-muted hover:bg-white dark:hover:bg-slate-800 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="flex-3 py-3 px-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    Creating...
                                </>
                            ) : (
                                'Delegate Task'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateDelegationDrawer;



