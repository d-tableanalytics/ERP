import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar as CalendarIcon, Users, AlignLeft, Flag, CheckSquare, Paperclip, Mic, Upload, Plus, ChevronDown, Search, Pencil, ChevronLeft, ChevronRight, Save, Trash2, Clock, Globe, Image as ImageIcon, Tag, Check, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import teamService from '../../services/teamService';
import delegationService from '../../services/delegationService';
import taskService from '../../services/taskService';
import holidayService from '../../services/holidayService';
import notificationService from '../../services/notificationService';

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

const TaskCreationForm = ({ isOpen, onClose, onSuccess, groupId, initialData, parentId, isMyTask }) => {
    const [formData, setFormData] = useState({
        taskTitle: '',
        description: '',
        doerId: [],
        category: '',
        priority: 'Low',
        dueDate: null,
        evidenceRequired: false,
        inLoopIds: [],
    });

    const [users, setUsers] = useState([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const [activeDropdown, setActiveDropdown] = useState(null);
    const toggleDropdown = (name) => {
        setActiveDropdown(prev => prev === name ? null : name);
    };
    const [activeModal, setActiveModal] = useState(null); // 'checklist', 'attachment', 'reminder', 'voice', 'date'
    const [dateTarget, setDateTarget] = useState('dueDate'); // 'dueDate', 'repeatStartDate', 'repeatEndDate'

    // Dropdown Searches & Data
    const [userSearch, setUserSearch] = useState('');
    const [loopSearch, setLoopSearch] = useState('');
    const [categorySearch, setCategorySearch] = useState('');
    const [categories, setCategories] = useState([]);
    const [isLoadingCategories, setIsLoadingCategories] = useState(false);

    // Add Category Modal
    const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [selectedColor, setSelectedColor] = useState('#137fec'); // Default blue
    const [holidays, setHolidays] = useState([]);
    const [weeklyOffs, setWeeklyOffs] = useState([]);
    const categoryColors = [
        '#137fec', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd',
        '#e11d48', '#c026d3', '#9333ea', '#7c3aed', '#4f46e5',
        '#0284c7', '#0891b2', '#0d9488', '#059669', '#16a34a',
        '#65a30d', '#ca8a04', '#d97706', '#ea580c', '#dc2626',
        '#4b5563', '#1f2937'
    ];

    // Calendar
    const [currentCalMonth, setCurrentCalMonth] = useState(new Date());
    const [tempSelectedDate, setTempSelectedDate] = useState(null);
    const [datePickerView, setDatePickerView] = useState('date'); // 'date' | 'time'
    const [tempSelectedTime, setTempSelectedTime] = useState({ hours: '12', minutes: '00', ampm: 'PM' });

    // Checklist
    const [checklistExpanded, setChecklistExpanded] = useState(false);
    const [checklistItems, setChecklistItems] = useState([]);
    const [newChecklistText, setNewChecklistText] = useState('');

    // Reminders
    const [reminders, setReminders] = useState([{
        id: 1,
        medium: 'WhatsApp',  // WhatsApp, Email, Both
        timingValue: '10',
        timingUnit: 'minutes',
        timingRelation: 'Before' // Before, After
    }]);

    // File Input Refs
    const fileInputRef = useRef(null);
    const imageInputRef = useRef(null);
    const [attachments, setAttachments] = useState([]);

    // Links
    const [links, setLinks] = useState([]);
    const [newLinkText, setNewLinkText] = useState('');

    // Tags
    const [tags, setTags] = useState([]); // selected tags
    const [availableTags, setAvailableTags] = useState([]);
    const [isLoadingTags, setIsLoadingTags] = useState(false);
    const [isCreateTagModalOpen, setIsCreateTagModalOpen] = useState(false);
    const [newTagData, setNewTagData] = useState({ text: '', color: '#137fec' });

    const presetTagColors = [
        '#137fec', '#2196f3', '#42a5f5', '#64b5f6', '#4dd0e1',
        '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#26a69a',
        '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800',
        '#607d8b', '#455a64'
    ];

    // Repeat Task
    const [isRepeat, setIsRepeat] = useState(false);
    const [repeatMode, setRepeatMode] = useState('Daily');
    const [repeatEndDate, setRepeatEndDate] = useState('');
    const [weeklyDays, setWeeklyDays] = useState([]); // ['Monday', 'Tuesday', ...]
    const [selectedDates, setSelectedDates] = useState([]); // ['01', '15', ...]
    const [repeatStartDate, setRepeatStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [repeatIntervalDays, setRepeatIntervalDays] = useState('1');
    const [occurEveryMode, setOccurEveryMode] = useState('Week'); // 'Week' | 'Month'
    const [customOccurValue, setCustomOccurValue] = useState('1');
    const [customOccurDays, setCustomOccurDays] = useState([]);
    const [customOccurDates, setCustomOccurDates] = useState([]);

    // Voice
    const [isRecording, setIsRecording] = useState(false);
    const [voiceState, setVoiceState] = useState('idle');
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const [audioBlob, setAudioBlob] = useState(null);

    useEffect(() => {
        let interval;
        if (voiceState === 'recording') {
            interval = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [voiceState]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    useEffect(() => {
        if (isOpen) {
            fetchUsers();
            fetchCategories();
            fetchTags();
            fetchNotificationSettings();

            if (initialData) {
                setFormData({
                    taskTitle: initialData.taskTitle || initialData.title || '',
                    description: initialData.description || '',
                    doerId: Array.isArray(initialData.doerId) ? initialData.doerId : [initialData.doerId].filter(Boolean),
                    category: initialData.category || '',
                    priority: initialData.priority || 'Low',
                    dueDate: initialData.dueDate ? new Date(initialData.dueDate) : null,
                    evidenceRequired: initialData.evidenceRequired || false,
                    inLoopIds: Array.isArray(initialData.inLoopIds) ? initialData.inLoopIds : (typeof initialData.inLoopIds === 'string' ? JSON.parse(initialData.inLoopIds || '[]') : []),
                });

                if (initialData.checklistItems) {
                    const parsed = typeof initialData.checklistItems === 'string' ? JSON.parse(initialData.checklistItems) : initialData.checklistItems;
                    setChecklistItems(parsed.map((item, idx) => ({ id: Date.now() + idx, text: item.itemName || item.text || '', completed: item.completed || false })));
                    setChecklistExpanded(parsed.length > 0);
                }

                if (initialData.tags) {
                    const parsedTags = typeof initialData.tags === 'string' ? JSON.parse(initialData.tags) : initialData.tags;
                    setTags(Array.isArray(parsedTags) ? parsedTags : []);
                }

                if (initialData.reminders) {
                    const parsedReminders = typeof initialData.reminders === 'string' ? JSON.parse(initialData.reminders) : initialData.reminders;
                    setReminders(Array.isArray(parsedReminders) ? parsedReminders.map((r, idx) => ({ id: r.id || Date.now() + idx, ...r, timeValue: r.timeValue?.toString() || '10' })) : []);
                }

                if (initialData.referenceDocs && typeof initialData.referenceDocs === 'string') {
                    setLinks(initialData.referenceDocs.split(',').filter(Boolean));
                } else if (Array.isArray(initialData.referenceDocs)) {
                    setLinks(initialData.referenceDocs);
                }
            } else {
                setFormData({ taskTitle: '', description: '', doerId: [], category: '', priority: 'Low', dueDate: null, evidenceRequired: false, inLoopIds: [], });
                setChecklistItems([]);
                setChecklistExpanded(false);
            }
            setError(null); setActiveDropdown(null); setActiveModal(null); setLinks([]); setTags([]); setNewLinkText('');
            setNewTagData({ text: '', color: '#137fec' }); setIsCreateTagModalOpen(false); setRepeatMode('Daily');
            setRepeatEndDate(''); setRepeatStartDate(new Date().toISOString().split('T')[0]); fetchHolidays();
            setRepeatIntervalDays('1'); setOccurEveryMode('Week'); setCustomOccurValue('1');
            setWeeklyDays([]); setSelectedDates([]); setCustomOccurDays([]); setCustomOccurDates([]);
            setVoiceState('idle'); setRecordingTime(0); setAudioBlob(null); audioChunksRef.current = [];
            if (isMyTask && !initialData) {
                const storedUser = JSON.parse(localStorage.getItem('user'));
                const userId = storedUser?.user?.id || storedUser?.id || storedUser?.User_Id;
                if (userId) {
                    setFormData(prev => ({ ...prev, doerId: [userId] }));
                }
            }
        }
    }, [isOpen, initialData, isMyTask]);

    const fetchUsers = async () => {
        try {
            setIsLoadingUsers(true);
            let data;
            if (groupId) {
                const response = await delegationService.getGroupMembers(groupId);
                data = response.data || [];
            } else {
                data = await teamService.getUsers();
            }
            setUsers(Array.isArray(data) ? data : (data.data || []));
        } catch (err) { console.error('Failed to fetch users:', err); } finally { setIsLoadingUsers(false); }
    };

    const fetchHolidays = async () => {
        try { const data = await holidayService.getHolidays(); setHolidays(data); } catch (err) { console.error('Failed to fetch holidays:', err); }
    };

    const fetchNotificationSettings = async () => {
        try {
            const response = await notificationService.getSettings();
            if (response?.success && response.data?.weeklyOffs) { setWeeklyOffs(response.data.weeklyOffs); }
        } catch (err) { console.error('Failed to fetch notification settings:', err); }
    };

    const fetchTags = async () => {
        try {
            setIsLoadingTags(true);
            const data = await delegationService.getTagsList();
            setAvailableTags(Array.isArray(data) ? data : (data.data || []));
        } catch (err) { console.error('Failed to fetch tags:', err); } finally { setIsLoadingTags(false); }
    };

    const handleSaveTag = async () => {
        if (!newTagData.text.trim()) return;
        try {
            const storedUser = JSON.parse(localStorage.getItem('user'));
            const userId = storedUser?.user?.id || storedUser?.id || storedUser?.User_Id;
            const newTag = await delegationService.createTag({ name: newTagData.text.trim(), color: newTagData.color, createdBy: userId });
            setAvailableTags([newTag, ...availableTags]);
            setTags(prev => [...prev, { text: newTag.name, color: newTag.color, id: newTag.id }]);
            setIsCreateTagModalOpen(false); setNewTagData({ text: '', color: '#137fec' });
        } catch (err) { toast.error('Failed to create tag'); }
    };

    const toggleTag = (tag) => {
        const isSelected = tags.some(t => t.id === tag.id || (t.text === tag.name && t.color === tag.color));
        if (isSelected) { setTags(prev => prev.filter(t => t.id !== tag.id && (t.text !== tag.name || t.color !== tag.color))); }
        else { setTags(prev => [...prev, { text: tag.name, color: tag.color, id: tag.id }]); }
    };

    const fetchCategories = async () => {
        try {
            setIsLoadingCategories(true);
            const data = await delegationService.getCategories();
            setCategories(Array.isArray(data) ? data : (data.data || []));
        } catch (err) { console.error('Failed to fetch categories:', err); } finally { setIsLoadingCategories(false); }
    };

    const handleSaveCategory = async () => {
        if (!newCategoryName.trim()) return;
        try {
            const newCat = await delegationService.createCategory({ name: newCategoryName.trim(), color: selectedColor });
            setCategories([newCat, ...categories]);
            setFormData(prev => ({ ...prev, category: newCat.name }));
            setIsAddCategoryModalOpen(false); setNewCategoryName(''); setActiveDropdown(null);
        } catch (err) { setError('Failed to create category'); }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const toggleModal = (modal, target = 'dueDate') => {
        const isClosing = activeModal === modal && (modal !== 'date' || dateTarget === target);
        setActiveModal(isClosing ? null : modal);
        if (modal === 'date') {
            setDateTarget(target); setDatePickerView('date');
            let initialDate = target === 'dueDate' ? formData.dueDate : (target === 'repeatStartDate' ? (repeatStartDate ? new Date(repeatStartDate) : new Date()) : (repeatEndDate ? new Date(repeatEndDate) : new Date()));
            if (initialDate && initialDate instanceof Date && !isNaN(initialDate)) {
                setTempSelectedDate(initialDate); setCurrentCalMonth(initialDate);
                let h = initialDate.getHours(); const m = initialDate.getMinutes().toString().padStart(2, '0');
                const ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
                setTempSelectedTime({ hours: h.toString().padStart(2, '0'), minutes: m, ampm });
            } else { setTempSelectedDate(new Date()); setCurrentCalMonth(new Date()); setTempSelectedTime({ hours: '12', minutes: '00', ampm: 'PM' }); }
        }
    };

    const openModal = (modalName) => { setActiveDropdown(null); setActiveModal(modalName); if (modalName === 'checklist') { setChecklistExpanded(true); setTimeout(() => document.getElementById('checklist-input')?.focus(), 100); } };

    const toggleUserSelect = (userId, field) => {
        setFormData(prev => {
            const list = prev[field];
            if (list.includes(userId)) return { ...prev, [field]: list.filter(id => id !== userId) };
            return { ...prev, [field]: [...list, userId] };
        });
    };

    const handleAddChecklistItem = (e) => {
        if (e.key === 'Enter' && newChecklistText.trim()) {
            setChecklistItems([...checklistItems, { id: Date.now(), text: newChecklistText.trim(), completed: false }]);
            setNewChecklistText('');
        }
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            const oversized = newFiles.filter(f => f.size > 50 * 1024 * 1024);
            if (oversized.length > 0) { toast.error(`Some files exceed 50MB: ${oversized.map(f => f.name).join(', ')}`); return; }
            setAttachments(prev => [...prev, ...newFiles]);
        }
    };

    const addReminder = () => { setReminders([...reminders, { id: Date.now(), medium: 'WhatsApp', timingValue: '10', timingUnit: 'minutes', timingRelation: 'Before' }]); };
    const updateReminder = (id, field, value) => { setReminders(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r)); };
    const removeReminder = (id) => { setReminders(prev => prev.filter(r => r.id !== id)); };

    const renderEmptyState = () => (
        <div className="flex flex-col items-center justify-center p-6 text-center select-none">
            <div className="relative mb-6">
                <div className="w-[72px] h-[88px] bg-slate-100 rounded-xl shadow-inner absolute -left-5 -rotate-6"></div>
                <div className="w-[72px] h-[88px] bg-white rounded-xl shadow-lg border border-slate-200 p-2.5 flex flex-col gap-2 z-10 relative">
                    <div className="w-full h-1.5 bg-slate-200 rounded-full"></div>
                    <div className="w-3/4 h-1.5 bg-slate-200 rounded-full"></div>
                    <div className="w-1/2 h-1.5 bg-slate-200 rounded-full"></div>
                    <div className="w-full h-2 bg-blue-100/50 rounded-full mt-auto"></div>
                </div>
                <div className="absolute -bottom-3 -right-3 w-[46px] h-[46px] bg-[#137fec] rounded-full flex items-center justify-center z-20 shadow-xl border-4 border-white">
                    <Search size={22} className="text-white" strokeWidth={3} />
                </div>
            </div>
            <div className="text-slate-400 font-bold text-[15px] mt-2">No user found</div>
        </div>
    );

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        try {
            setIsSubmitting(true); setError(null);
            const storedUser = JSON.parse(localStorage.getItem('user'));
            const assignerId = storedUser?.user?.id || storedUser?.id || storedUser?.User_Id;
            if (!assignerId) throw new Error('User not authenticated');
            if (!formData.taskTitle.trim()) throw new Error('Task Title is required');
            if (formData.doerId.length === 0) throw new Error('Assignee is required');
            if (!formData.dueDate) throw new Error('Due Date is required');
            if (!formData.category) throw new Error('Category is required');


            const formDataToSend = new FormData();
            
            // Append basic fields
            formDataToSend.append('taskTitle', formData.taskTitle);
            formDataToSend.append('description', formData.description);
            formDataToSend.append('assignerId', assignerId);
            formDataToSend.append('assignerName', storedUser?.user?.name || storedUser?.name || 'Unknown');
            formDataToSend.append('department', formData.department);
            formDataToSend.append('priority', formData.priority);
            formDataToSend.append('dueDate', formData.dueDate ? new Date(formData.dueDate).toISOString() : '');
            formDataToSend.append('evidenceRequired', formData.evidenceRequired);
            formDataToSend.append('category', formData.category);
            formDataToSend.append('groupId', groupId || '');
            formDataToSend.append('parentId', parentId || '');

            // Append complex objects as JSON strings
            formDataToSend.append('tags', JSON.stringify(tags || []));
            formDataToSend.append('checklistItems', JSON.stringify(checklistItems.map(item => ({ itemName: item.text, completed: item.completed }))));
            formDataToSend.append('inLoopIds', JSON.stringify(formData.inLoopIds || []));
            formDataToSend.append('repeatSettings', JSON.stringify({
                isRepeat,
                repeatFrequency: repeatMode,
                repeatStartDate,
                repeatEndDate,
                repeatIntervalDays,
                weeklyDays,
                selectedDates,
                occurEveryMode,
                customOccurValue,
                customOccurDays,
                customOccurDates
            }));
            formDataToSend.append('reminders', JSON.stringify((reminders || []).map(r => ({
                type: r.medium || 'Email',
                timeValue: parseInt(r.timingValue || '0'),
                timeUnit: r.timingUnit || 'minutes',
                triggerType: (r.timingRelation || 'Before').toLowerCase()
            }))));

            // Append Files
            if (audioBlob) {
                formDataToSend.append('voice_note', audioBlob, `voice-note-${Date.now()}.webm`);
            }
            if (attachments.length > 0) {
                attachments.forEach(file => {
                    formDataToSend.append('reference_docs', file);
                });
            }

            // Multiple doers support
            formData.doerId.forEach(id => {
                formDataToSend.append('doerId', id);
            });

            const isEdit = !!initialData?.id;
            if (isEdit) { 
                // For edit, we still use the old service for now or I should migrate it too?
                // The user specifically asked for CURRENT task creation.
                await delegationService.updateDelegation(initialData.id, formDataToSend); 
                toast.success('Task updated successfully!'); 
            } else { 
                // Use the new taskService for creation
                await taskService.createTask(formDataToSend); 
                toast.success('Task created successfully!'); 
            }
            onSuccess?.(); onClose();
        } catch (err) {
            setError(err.message || 'Failed to create task');
            toast.error(err.message || 'Failed to create task');
        } finally { setIsSubmitting(false); }
    };

    if (!isOpen) return null;

    const filteredUsers = (users || []).filter(u => {
        if (!u) return false;
        const q = (userSearch || '').toLowerCase();
        const fullName = `${u.firstName || u.name || ''} ${u.lastName || ''}`.trim().toLowerCase();
        const email = (u.email || u.workEmail || '').toLowerCase();
        return fullName.includes(q) || email.includes(q);
    });

    const filteredLoopUsers = (users || []).filter(u => {
        if (!u) return false;
        const q = (loopSearch || '').toLowerCase();
        const fullName = `${u.firstName || u.name || ''} ${u.lastName || ''}`.trim().toLowerCase();
        const email = (u.email || u.workEmail || '').toLowerCase();
        return fullName.includes(q) || email.includes(q);
    });

    const filteredCategories = (categories || []).filter(c => (c?.name || '').toLowerCase().includes((categorySearch || '').toLowerCase()));
    const isSameDate = (d1, d2) => d1 && d2 && d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();

    return (
        <div className="fixed inset-0 z-[70] flex p-0 sm:p-4 lg:p-8 pt-0 sm:pt-[5vh] justify-center items-start animate-in fade-in duration-300 overflow-hidden">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-[680px] h-full sm:h-auto max-h-screen sm:max-h-[92vh] bg-white sm:rounded-2xl shadow-2xl border border-slate-200/60 animate-in zoom-in-95 duration-300 flex flex-col overflow-visible">
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-blue-50/30 relative sm:rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#137fec] flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Plus size={16} className="text-white" strokeWidth={3} />
                        </div>
                        <div>
                            <h2 className="text-xs font-bold text-slate-800 leading-tight">{initialData?.id ? 'Edit Task' : (isMyTask ? 'Add New Task' : 'Assign New Task')}</h2>
                            <p className="text-[8px] text-[#137fec] font-bold uppercase tracking-widest">{initialData?.id ? (isMyTask ? 'Modify Task' : 'Modify Delegation') : (isMyTask ? 'PERSONAL TASK' : 'NEW DELEGATION')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-[#137fec] hover:bg-blue-50 transition-all">
                        <X size={16} strokeWidth={2.5} />
                    </button>
                </div>

                {error && (
                    <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 text-red-500 rounded-xl text-sm flex items-center gap-3 animate-in slide-in-from-top-2 duration-200">
                        <AlertCircle size={14} /> {error}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0 bg-white">
                    <div className="border-b border-slate-50 p-3 bg-blue-50/5">
                        <input type="text" name="taskTitle" value={formData.taskTitle} onChange={handleChange} placeholder="Add Task Title *..." className="w-full bg-transparent text-sm font-bold text-slate-800 placeholder:text-slate-300 outline-none focus:placeholder:text-slate-400" autoFocus />
                    </div>
                    <div className="border-b border-slate-50 p-3 w-full min-h-[100px]">
                        <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Write task details, instructions or goals here *..." className="w-full h-full min-h-[70px] bg-transparent text-[11px] font-medium text-slate-600 placeholder:text-slate-300 outline-none resize-none leading-relaxed" />
                    </div>

                    <div className="border-b border-slate-50 transition-all bg-slate-50/30">
                        <div className="p-2.5 text-[#137fec] font-bold text-[10px] cursor-pointer hover:text-blue-700 transition-colors flex items-center justify-between uppercase tracking-widest" onClick={() => { setChecklistExpanded(!checklistExpanded); if (!checklistExpanded) setTimeout(() => document.getElementById('checklist-input')?.focus(), 100); }}>
                            <span className="flex items-center gap-2"><Plus size={14} strokeWidth={3} /> Add Checklist</span>
                            <ChevronDown size={12} className={`text-slate-400 transition-transform ${checklistExpanded ? 'rotate-180' : ''}`} />
                        </div>
                        {checklistExpanded && (
                            <div className="px-5 pb-4 animate-in slide-in-from-top-2 duration-300">
                                <div className="space-y-2 mb-3 mt-1">
                                    {checklistItems.map(item => (
                                        <div key={item.id} className="flex items-center gap-2.5 group">
                                            <button onClick={() => updateReminder(item.id, 'completed', !item.completed)} className={`shrink-0 w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${item.completed ? 'bg-[#137fec] border-[#137fec] text-white' : 'border-slate-300 bg-white hover:border-[#137fec]'}`}>
                                                {item.completed && <Check size={10} strokeWidth={4} />}
                                            </button>
                                            <span className={`text-[11px] font-bold flex-1 ${item.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item.text}</span>
                                            <button onClick={() => setChecklistItems(prev => prev.filter(i => i.id !== item.id))} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"><Trash2 size={14} /></button>
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-white rounded-xl border border-slate-100 p-2 flex items-center gap-2.5 transition-all shadow-sm">
                                    <input id="checklist-input" type="text" placeholder="Add more tasks to checklist..." value={newChecklistText} onChange={e => setNewChecklistText(e.target.value)} onKeyDown={handleAddChecklistItem} className="bg-transparent text-[11px] font-bold text-slate-800 placeholder:text-slate-300 outline-none w-full px-2" />
                                    <button onClick={() => handleAddChecklistItem({ key: 'Enter' })} className="bg-[#137fec] hover:bg-blue-600 text-white p-1 rounded-lg shadow-md transition-all active:scale-95"><Plus size={14} strokeWidth={3} /></button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-3 flex flex-wrap items-center gap-1.5 border-b border-slate-50 relative bg-blue-50/5">
                        <button onClick={() => toggleModal('users')} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 text-[8px] font-bold transition-all shadow-sm uppercase tracking-wide ${formData.doerId.length > 0 ? 'border-[#137fec] bg-blue-50 text-[#137fec]' : 'border-slate-100 bg-white text-slate-400 hover:border-blue-500/30'}`}>
                            <Users size={14} /> {isLoadingUsers ? 'Loading...' : formData.doerId.length > 0 ? `${formData.doerId.length} Selected` : 'Assignee *'}
                        </button>
                        <button onClick={() => toggleModal('date')} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 text-[8px] font-bold transition-all shadow-sm uppercase tracking-wide ${formData.dueDate ? 'border-[#137fec] bg-blue-50 text-[#137fec]' : 'border-slate-100 bg-white text-slate-400 hover:border-blue-500/30'}`}>
                            <CalendarIcon size={14} /> {formData.dueDate ? new Date(formData.dueDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Set Deadline'}
                        </button>
                        <div className="relative">
                            <button onClick={(e) => { e.stopPropagation(); toggleDropdown('priority'); }} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 text-[8px] font-bold transition-all shadow-sm uppercase tracking-wide ${formData.priority === 'High' ? 'border-red-500 bg-red-50 text-red-600' : formData.priority === 'Medium' ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-[#137fec] bg-blue-50 text-[#137fec]'}`}>
                                <Flag size={14} /> {formData.priority} *
                            </button>
                            {activeDropdown === 'priority' && (
                                <div className="absolute top-[calc(100%+8px)] left-0 w-36 bg-white border border-slate-100 rounded-2xl shadow-xl z-[100] flex flex-col p-1.5 animate-in fade-in slide-in-from-top-2">
                                    {['High', 'Medium', 'Low'].map(p => (
                                        <button key={p} onClick={() => { setFormData(prev => ({ ...prev, priority: p })); setActiveDropdown(null); }} className={`text-left px-4 py-2 rounded-xl text-[11px] font-black uppercase transition-all ${formData.priority === p ? 'bg-[#137fec] text-white shadow-md' : 'text-slate-500 hover:bg-blue-50'}`}>{p}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button onClick={() => toggleModal('category')} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 text-[8px] font-bold transition-all shadow-sm uppercase tracking-wide ${formData.category ? 'border-[#137fec] bg-blue-50 text-[#137fec]' : 'border-slate-100 bg-white text-slate-400 hover:border-blue-500/30'}`}>
                            <CheckSquare size={14} /> {formData.category || 'Category *'}
                        </button>
                        <button onClick={() => openModal('inLoop')} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 text-[8px] font-bold transition-all shadow-sm uppercase tracking-wide ${formData.inLoopIds.length > 0 ? 'border-[#137fec] bg-blue-50 text-[#137fec]' : 'border-slate-100 bg-white text-slate-400 hover:border-blue-500/30'}`}>
                            <Users size={14} /> {formData.inLoopIds.length > 0 ? `${formData.inLoopIds.length} in Loop` : 'In Loop'}
                        </button>
                        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg border-2 border-slate-100 bg-white text-slate-400 hover:border-blue-500/30 transition-all shadow-sm">
                            <label className="flex items-center gap-1.5 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input type="checkbox" name="evidenceRequired" checked={formData.evidenceRequired} onChange={handleChange} className="peer h-3.5 w-3.5 opacity-0 absolute z-10 cursor-pointer" />
                                    <div className={`h-3.5 w-3.5 rounded-md border-2 transition-all flex items-center justify-center ${formData.evidenceRequired ? 'bg-[#137fec] border-[#137fec]' : 'border-slate-200'}`}>
                                        {formData.evidenceRequired && <Check size={8} className="text-white" strokeWidth={4} />}
                                    </div>
                                </div>
                                <span className={`text-[8px] font-bold uppercase transition-colors ${formData.evidenceRequired ? 'text-[#137fec]' : 'text-slate-400'}`}>Evidence</span>
                            </label>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2.5 p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100 mx-4 my-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <div className="relative flex items-center">
                                    <input type="checkbox" checked={isRepeat} onChange={(e) => setIsRepeat(e.target.checked)} className="peer h-3.5 w-3.5 opacity-0 absolute z-10 cursor-pointer" />
                                    <div className={`h-3.5 w-3.5 rounded-md border-2 transition-all flex items-center justify-center ${isRepeat ? 'bg-[#137fec] border-[#137fec]' : 'border-slate-200'}`}>
                                        {isRepeat && <Check size={8} className="text-white" strokeWidth={4} />}
                                    </div>
                                </div>
                                <span className={`text-[10px] font-black uppercase transition-colors ${isRepeat ? 'text-[#137fec]' : 'text-slate-400'}`}>Repeat</span>
                            </label>
                            {isRepeat && (
                                <>
                                    <button onClick={() => toggleDropdown('repeatMode')} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 border-slate-100 bg-white text-[9px] font-black text-slate-700 hover:border-blue-500/30 shadow-sm uppercase">
                                        {repeatMode} <ChevronDown size={10} />
                                    </button>
                                    <button onClick={() => toggleModal('date', 'repeatStartDate')} className="flex items-center bg-white border-2 border-slate-100 rounded-lg px-2.5 py-1 hover:border-blue-500/30 shadow-sm">
                                        <CalendarIcon size={12} className="text-slate-300 mr-1.5" />
                                        <span className="text-[9px] font-black text-slate-700">{repeatStartDate || 'Start Date'}</span>
                                    </button>
                                    <button onClick={() => toggleModal('date', 'repeatEndDate')} className="flex items-center bg-white border-2 border-slate-100 rounded-lg px-2.5 py-1 hover:border-blue-500/30 shadow-sm">
                                        <CalendarIcon size={12} className="text-slate-300 mr-1.5" />
                                        <span className="text-[9px] font-black text-slate-700">{repeatEndDate || 'End Date'}</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 px-6 pb-6">
                        {tags.length > 0 && <div className="flex flex-wrap gap-2">{tags.map((tag, i) => <div key={i} className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[11px] font-black border uppercase" style={{ backgroundColor: `${tag.color}10`, borderColor: `${tag.color}30`, color: tag.color }}><Tag size={12} /> {tag.text} <X size={12} className="cursor-pointer" onClick={() => setTags(prev => prev.filter((_, idx) => idx !== i))} /></div>)}</div>}
                        {links.length > 0 && <div className="flex flex-wrap gap-2">{links.map((link, i) => <div key={i} className="flex items-center gap-2.5 bg-blue-50 border-2 border-blue-100 px-3.5 py-1.5 rounded-xl text-[12px] font-black text-[#137fec] shadow-sm"><Globe size={14} /> <span className="truncate max-w-[200px]">{link}</span> <X size={14} className="cursor-pointer" onClick={() => setLinks(prev => prev.filter((_, idx) => idx !== i))} /></div>)}</div>}
                        {attachments.length > 0 && <div className="flex flex-wrap gap-2">{attachments.map((file, i) => <div key={i} className="flex items-center gap-2.5 bg-slate-50 border-2 border-slate-100 px-3.5 py-1.5 rounded-xl text-[12px] font-black text-slate-700 shadow-sm"><Paperclip size={14} /> <span className="truncate max-w-[200px]">{file.name}</span> <X size={14} className="cursor-pointer" onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} /></div>)}</div>}
                    </div>
                </div>

                <div className="p-3 flex items-center justify-between border-t border-slate-100 bg-white sm:rounded-b-2xl relative">
                    <div className="flex items-center gap-1">
                        <button onClick={() => openModal('attachment')} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${attachments.length > 0 ? 'text-[#137fec] bg-blue-50' : 'text-slate-400 hover:text-[#137fec] hover:bg-blue-50'}`}><Paperclip size={16} /></button>
                        <button onClick={() => openModal('reminder')} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${reminders.length > 0 ? 'text-[#137fec] bg-blue-50' : 'text-slate-400 hover:text-[#137fec] hover:bg-blue-50'}`}><Clock size={16} /></button>
                        <button onClick={() => openModal('voice')} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${voiceState === 'recorded' ? 'text-[#137fec] bg-blue-50' : 'text-slate-400 hover:text-[#137fec] hover:bg-blue-50'}`}><Mic size={16} /></button>
                        <button onClick={() => openModal('tags')} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${tags.length > 0 ? 'text-[#137fec] bg-blue-50' : 'text-slate-400 hover:text-[#137fec] hover:bg-blue-50'}`}><Tag size={16} /></button>
                    </div>
                    <button onClick={handleSubmit} disabled={isSubmitting} className="px-6 py-2 bg-[#137fec] hover:bg-blue-700 text-white font-bold rounded-xl text-[11px] transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 uppercase tracking-widest">
                        {isSubmitting ? <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" /> : <Upload size={14} strokeWidth={3} />}
                        {isSubmitting ? 'Processing...' : (initialData?.id ? 'Update Task' : 'Assign Task')}
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple />
                    <input type="file" ref={imageInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" multiple />
                </div>

                {activeModal === 'date' && (
                    <ActionModal title={`Select deadline`} onClose={() => setActiveModal(null)} onSave={() => { if (!tempSelectedDate) return; const finalDate = new Date(tempSelectedDate); if (dateTarget === 'dueDate') { let h = parseInt(tempSelectedTime.hours); if (tempSelectedTime.ampm === 'PM' && h < 12) h += 12; if (tempSelectedTime.ampm === 'AM' && h === 12) h = 0; finalDate.setHours(h, parseInt(tempSelectedTime.minutes), 0, 0); setFormData(prev => ({ ...prev, dueDate: finalDate })); } else if (dateTarget === 'repeatStartDate') setRepeatStartDate(finalDate.toISOString().split('T')[0]); else setRepeatEndDate(finalDate.toISOString().split('T')[0]); setActiveModal(null); }}>
                        <div className="flex flex-col gap-6">
                            {dateTarget === 'dueDate' && (
                                <div className="flex bg-slate-100 p-1 rounded-2xl self-center">
                                    <button onClick={() => setDatePickerView('date')} className={`px-8 py-2 rounded-xl text-[11px] font-black uppercase transition-all ${datePickerView === 'date' ? 'bg-white text-[#137fec] shadow-sm' : 'text-slate-400'}`}>Date</button>
                                    <button onClick={() => setDatePickerView('time')} className={`px-8 py-2 rounded-xl text-[11px] font-black uppercase transition-all ${datePickerView === 'time' ? 'bg-white text-[#137fec] shadow-sm' : 'text-slate-400'}`}>Time</button>
                                </div>
                            )}
                            {datePickerView === 'date' ? (
                                <div className="animate-in fade-in duration-300">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm font-black text-slate-800 uppercase bg-blue-50 px-4 py-2 rounded-xl">{currentCalMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                                        <div className="flex gap-1">
                                            <button onClick={() => setCurrentCalMonth(new Date(currentCalMonth.getFullYear(), currentCalMonth.getMonth() - 1, 1))} className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-[#137fec]"><ChevronLeft size={16} /></button>
                                            <button onClick={() => setCurrentCalMonth(new Date(currentCalMonth.getFullYear(), currentCalMonth.getMonth() + 1, 1))} className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-[#137fec]"><ChevronRight size={16} /></button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-7 gap-1 text-center font-black text-[10px] text-slate-300 uppercase mb-2">
                                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
                                    </div>
                                    <div className="grid grid-cols-7 gap-1">
                                        {Array.from({ length: getFirstDayOfMonth(currentCalMonth.getFullYear(), currentCalMonth.getMonth()) }).map((_, i) => <div key={i} />)}
                                        {Array.from({ length: getDaysInMonth(currentCalMonth.getFullYear(), currentCalMonth.getMonth()) }).map((_, i) => {
                                            const d = i + 1; const dateObj = new Date(currentCalMonth.getFullYear(), currentCalMonth.getMonth(), d);
                                            const isSelected = tempSelectedDate && isSameDate(tempSelectedDate, dateObj);
                                            const isToday = isSameDate(new Date(), dateObj);
                                            return <button key={d} onClick={() => setTempSelectedDate(dateObj)} className={`w-8 h-8 mx-auto rounded-lg text-[11px] font-black transition-all ${isSelected ? 'bg-[#137fec] text-white shadow-md' : isToday ? 'border-2 border-blue-100 text-[#137fec]' : 'text-slate-600 hover:bg-blue-50'}`}>{d}</button>
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-6 py-6 font-black">
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col items-center gap-1">
                                            <button onClick={() => { let h = parseInt(tempSelectedTime.hours); h = h >= 12 ? 1 : h + 1; setTempSelectedTime(p => ({ ...p, hours: h.toString().padStart(2, '0') })); }} className="text-slate-300 hover:text-[#137fec]"><ChevronDown className="rotate-180" /></button>
                                            <div className="text-4xl text-slate-800">{tempSelectedTime.hours}</div>
                                            <button onClick={() => { let h = parseInt(tempSelectedTime.hours); h = h <= 1 ? 12 : h - 1; setTempSelectedTime(p => ({ ...p, hours: h.toString().padStart(2, '0') })); }} className="text-slate-300 hover:text-[#137fec]"><ChevronDown /></button>
                                        </div>
                                        <div className="text-4xl text-slate-200">:</div>
                                        <div className="flex flex-col items-center gap-1">
                                            <button onClick={() => { let m = parseInt(tempSelectedTime.minutes); m = m >= 59 ? 0 : m + 1; setTempSelectedTime(p => ({ ...p, minutes: m.toString().padStart(2, '0') })); }} className="text-slate-300 hover:text-[#137fec]"><ChevronDown className="rotate-180" /></button>
                                            <div className="text-4xl text-slate-800">{tempSelectedTime.minutes}</div>
                                            <button onClick={() => { let m = parseInt(tempSelectedTime.minutes); m = m <= 0 ? 59 : m - 1; setTempSelectedTime(p => ({ ...p, minutes: m.toString().padStart(2, '0') })); }} className="text-slate-300 hover:text-[#137fec]"><ChevronDown /></button>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            {['AM', 'PM'].map(p => <button key={p} onClick={() => setTempSelectedTime(prev => ({ ...prev, ampm: p }))} className={`px-4 py-2 rounded-xl text-[12px] border-2 transition-all ${tempSelectedTime.ampm === p ? 'bg-[#137fec] border-[#137fec] text-white' : 'bg-white border-slate-100 text-slate-400'}`}>{p}</button>)}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ActionModal>
                )}

                {activeModal === 'users' && (
                    <ActionModal title="Assign To" onClose={() => setActiveModal(null)} onSave={() => setActiveModal(null)}>
                        <div className="flex flex-col gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                <input type="text" placeholder="Search team..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 pl-10 pr-4 text-sm font-bold outline-none focus:border-blue-500/30" autoFocus />
                            </div>
                            <div className="max-h-[40vh] overflow-y-auto px-1 flex flex-col gap-1 custom-scrollbar">
                                {filteredUsers.map(u => {
                                    const uid = u.userId || u.id || u.User_Id;
                                    const isSelected = formData.doerId.includes(uid);
                                    return (
                                        <div key={uid} onClick={() => toggleUserSelect(uid, 'doerId')} className={`p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all border-2 ${isSelected ? 'bg-blue-50 border-[#137fec]' : 'border-transparent hover:bg-slate-50'}`}>
                                            <div className="w-10 h-10 rounded-full bg-[#137fec] flex items-center justify-center text-white font-black text-xs shrink-0">{ (u.firstName || u.name)?.[0] }</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-black text-slate-800 truncate">{u.firstName || u.name} {u.lastName || ''}</div>
                                                <div className="text-xs text-slate-400 truncate">{u.email || u.workEmail}</div>
                                            </div>
                                            {isSelected && <Check size={16} className="text-[#137fec]" strokeWidth={4} />}
                                        </div>
                                    );
                                })}
                                {filteredUsers.length === 0 && renderEmptyState()}
                            </div>
                        </div>
                    </ActionModal>
                )}

                {activeModal === 'category' && (
                    <ActionModal title="Select Category" onClose={() => setActiveModal(null)} onSave={() => setActiveModal(null)} showAdd={true} onAdd={() => setIsAddCategoryModalOpen(true)}>
                        <div className="flex flex-col gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                <input type="text" placeholder="Find category..." value={categorySearch} onChange={e => setCategorySearch(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 pl-10 pr-4 text-sm font-bold outline-none" autoFocus />
                            </div>
                            <div className="max-h-[40vh] overflow-y-auto p-1 flex flex-col gap-1">
                                {filteredCategories.map(c => (
                                    <button key={c.id} onClick={() => { setFormData(prev => ({ ...prev, category: c.name })); setActiveModal(null); }} className={`text-left px-4 py-3 rounded-xl text-sm font-black transition-all flex items-center gap-3 border-2 ${formData.category === c.name ? 'text-[#137fec] bg-blue-50 border-[#137fec]' : 'text-slate-600 border-transparent hover:bg-slate-50'}`}>
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} /> {c.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </ActionModal>
                )}
                {activeModal === 'inLoop' && (
                    <ActionModal title="Add Team in Loop" onClose={() => setActiveModal(null)} onSave={() => setActiveModal(null)} saveText="Apply Selection">
                        <div className="flex flex-col gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                <input type="text" placeholder="Search team members..." value={loopSearch} onChange={e => setLoopSearch(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2.5 pl-10 pr-4 text-sm font-bold outline-none focus:border-blue-500/30" autoFocus />
                            </div>
                            <div className="max-h-[40vh] overflow-y-auto px-1 flex flex-col gap-1 custom-scrollbar">
                                {filteredLoopUsers.map(u => {
                                    const uid = u.userId || u.id || u.User_Id;
                                    const isSelected = formData.inLoopIds.includes(uid);
                                    return (
                                        <div key={uid} onClick={() => toggleUserSelect(uid, 'inLoopIds')} className={`p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all border-2 ${isSelected ? 'bg-blue-50 border-[#137fec]' : 'border-transparent hover:bg-slate-50'}`}>
                                            <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-black text-xs shrink-0">{ (u.firstName || u.name)?.[0] }</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-black text-slate-800 truncate">{u.firstName || u.name} {u.lastName || ''}</div>
                                                <div className="text-xs text-slate-400 truncate">{u.email || u.workEmail}</div>
                                            </div>
                                            {isSelected && <Check size={16} className="text-[#137fec]" strokeWidth={4} />}
                                        </div>
                                    );
                                })}
                                {filteredLoopUsers.length === 0 && renderEmptyState()}
                            </div>
                        </div>
                    </ActionModal>
                )}

                {activeModal === 'tags' && (
                    <ActionModal title="Task Tags" onClose={() => setActiveModal(null)} onSave={() => setActiveModal(null)} showAdd={true} onAdd={() => setIsCreateTagModalOpen(true)}>
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-wrap gap-2">
                                {availableTags.map(tag => {
                                    const isSelected = tags.some(t => t.id === tag.id || (t.text === tag.name && t.color === tag.color));
                                    return (
                                        <button key={tag.id} onClick={() => toggleTag(tag)} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider transition-all ${isSelected ? 'bg-blue-50 border-[#137fec] text-[#137fec]' : 'border-slate-100 bg-white text-slate-400 hover:border-blue-500/30'}`} style={isSelected ? { color: tag.color, borderColor: tag.color, backgroundColor: `${tag.color}10` } : {}}>
                                            <Tag size={12} /> {tag.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </ActionModal>
                )}

                {activeModal === 'attachment' && (
                    <ActionModal title="Add Attachments" onClose={() => setActiveModal(null)} onSave={() => setActiveModal(null)} showAdd={true} onAdd={() => fileInputRef.current?.click()}>
                        <div className="flex flex-col gap-3">
                            {attachments.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 text-xs font-bold uppercase tracking-widest">No attachments yet</div>
                            ) : (
                                attachments.map((file, i) => (
                                    <div key={i} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <Paperclip size={14} className="text-blue-500" />
                                            <span className="text-[11px] font-bold text-slate-600 truncate">{file.name}</span>
                                        </div>
                                        <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-red-500 px-1"><X size={16} /></button>
                                    </div>
                                ))
                            )}
                        </div>
                    </ActionModal>
                )}

                {activeModal === 'reminder' && (
                    <ActionModal title="Task Reminders" onClose={() => setActiveModal(null)} onSave={() => setActiveModal(null)} showAdd={true} onAdd={addReminder}>
                        <div className="flex flex-col gap-4">
                            {reminders.map((reminder, idx) => (
                                <div key={reminder.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 relative">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reminder {idx + 1}</span>
                                        <button onClick={() => removeReminder(reminder.id)} className="text-slate-300 hover:text-red-500"><X size={14} /></button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="number" value={reminder.timingValue} onChange={e => updateReminder(reminder.id, 'timingValue', e.target.value)} className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold" />
                                        <select value={reminder.timingUnit} onChange={e => updateReminder(reminder.id, 'timingUnit', e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none">
                                            <option value="minutes">Mins</option>
                                            <option value="hours">Hours</option>
                                            <option value="days">Days</option>
                                        </select>
                                        <select value={reminder.timingRelation} onChange={e => updateReminder(reminder.id, 'timingRelation', e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none">
                                            <option value="Before">Before</option>
                                            <option value="After">After</option>
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ActionModal>
                )}

                {activeModal === 'voice' && (
                    <ActionModal title="Voice Note" onClose={() => { setIsRecording(false); setVoiceState('idle'); setActiveModal(null); }} onSave={() => setActiveModal(null)} showFooter={voiceState === 'recorded'}>
                        <div className="flex flex-col items-center justify-center py-6">
                            {voiceState === 'idle' && (
                                <button onClick={() => {
                                    setIsRecording(true); setVoiceState('recording'); setRecordingTime(0);
                                    if (navigator.mediaDevices?.getUserMedia) {
                                        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                                            mediaRecorderRef.current = new MediaRecorder(stream);
                                            mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
                                            mediaRecorderRef.current.onstop = () => { const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); setAudioBlob(blob); audioChunksRef.current = []; stream.getTracks().forEach(t => t.stop()); };
                                            mediaRecorderRef.current.start();
                                        }).catch(() => { setVoiceState('idle'); setIsRecording(false); });
                                    }
                                }} className="w-16 h-16 rounded-full bg-[#137fec] text-white flex items-center justify-center shadow-lg hover:scale-105 transition-all"><Mic size={24} /></button>
                            )}
                            {voiceState === 'recording' && (
                                <div className="flex flex-col items-center">
                                    <div className="text-2xl font-black text-[#137fec] mb-4">{formatTime(recordingTime)}</div>
                                    <button onClick={() => { setIsRecording(false); setVoiceState('recorded'); mediaRecorderRef.current?.stop(); }} className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg animate-pulse"><div className="w-4 h-4 bg-white rounded-sm" /></button>
                                </div>
                            )}
                            {voiceState === 'recorded' && (
                                <div className="flex flex-col items-center w-full">
                                    <div className="bg-blue-50 p-4 rounded-2xl w-full mb-4 flex items-center justify-center">
                                        <audio controls src={audioBlob ? URL.createObjectURL(audioBlob) : ''} className="h-8" />
                                    </div>
                                    <button onClick={() => { setVoiceState('idle'); setAudioBlob(null); }} className="text-red-500 text-[10px] font-black uppercase tracking-widest">Discard & Redo</button>
                                </div>
                            )}
                        </div>
                    </ActionModal>
                )}
            </div>
            
            {/* Category Creation Modal */}
            {isAddCategoryModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
                    <div className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl p-8 animate-in zoom-in-95">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">New Category</h3>
                            <button onClick={() => setIsAddCategoryModalOpen(false)} className="text-slate-300 hover:text-red-500"><X /></button>
                        </div>
                        <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Category Name" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:border-blue-500/30 mb-8 uppercase" autoFocus />
                        <div className="grid grid-cols-10 gap-2.5 mb-8">
                            {categoryColors.map(color => <button key={color} onClick={() => setSelectedColor(color)} className={`w-7 h-7 rounded-lg transition-all ${selectedColor === color ? 'ring-4 ring-offset-2 scale-110' : ''}`} style={{ backgroundColor: color, '--tw-ring-color': color }} />)}
                        </div>
                        <button onClick={handleSaveCategory} disabled={!newCategoryName.trim()} className="w-full py-4 bg-[#137fec] hover:bg-blue-700 text-white font-bold rounded-2xl text-[12px] uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-30">Create Category</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const ActionModal = ({ title, children, showFooter = true, onClose, onSave, saveText = "Done", showAdd = false, onAdd }) => (
    <div className="absolute inset-0 z-[150] flex items-center justify-center bg-slate-900/10 backdrop-blur-[2px] rounded-2xl p-4">
        <div className="w-full max-w-[420px] bg-white border border-slate-100 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-50 bg-blue-50/20">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">{title}</h3>
                <button onClick={onClose} className="text-slate-300 hover:text-[#137fec]"><X size={18} /></button>
            </div>
            <div className="p-5 max-h-[50vh] overflow-y-auto custom-scrollbar">{children}</div>
            {showFooter && (
                <div className="p-4 border-t border-slate-50 flex items-center justify-end gap-2 bg-slate-50/30">
                    <button onClick={onClose} className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600">Cancel</button>
                    {showAdd && <button onClick={onAdd} className="px-4 py-2 rounded-xl border border-blue-200 bg-white hover:bg-blue-50 text-[#137fec] font-black text-[10px] uppercase tracking-widest flex items-center gap-1"><Plus size={14} /> Add More</button>}
                    <button onClick={onSave} className="px-6 py-2 rounded-xl bg-[#137fec] hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 active:scale-95">{saveText}</button>
                </div>
            )}
        </div>
    </div>
);

export default TaskCreationForm;
