import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar as CalendarIcon, Users, AlignLeft, Flag, CheckSquare, Paperclip, Mic, Upload, Plus, ChevronDown, Search, Pencil, ChevronLeft, ChevronRight, Save, Trash2, Clock, Globe, Image as ImageIcon, Check, AlertCircle, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDepartments } from '../../store/slices/masterSlice';
import teamService from '../../services/teamService';
import delegationService from '../../services/delegationService';
import taskService from '../../services/taskService';
import holidayService from '../../services/holidayService';
import notificationService from '../../services/notificationService';

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
const normalizeIdArray = (value) => {
    if (value === undefined || value === null || value === '' || value === 'undefined' || value === 'null') return [];
    if (Array.isArray(value)) {
        return value.map(v => parseInt(v)).filter(v => !isNaN(v));
    }
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed.map(v => parseInt(v)).filter(v => !isNaN(v));
        } catch {
            return value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
        }
    }
    const parsed = parseInt(value);
    return isNaN(parsed) ? [] : [parsed];
};

const normalizeTaskForForm = (data = {}) => ({
    taskTitle: data.taskTitle || data.delegation_name || data.title || '',
    description: data.description || '',
    doerId: normalizeIdArray(data.doerId ?? data.doer_id),
    department: data.department || '',
    category: data.category || '',
    priority: data.priority || 'Low',
    dueDate: data.dueDate || data.due_date ? new Date(data.dueDate || data.due_date) : null,
    evidenceRequired: data.evidenceRequired ?? data.evidence_required ?? false,
    inLoopIds: normalizeIdArray(data.inLoopIds ?? data.in_loop_ids),
});

const TaskCreationForm = ({ isOpen, onClose, onSuccess, groupId, initialData, parentId, isMyTask, apiMode = 'task' }) => {
    const dispatch = useDispatch();
    const { departments, isLoading: isMasterLoading } = useSelector((state) => state.master);
    const [formData, setFormData] = useState({
        taskTitle: '',
        description: '',
        doerId: [],
        department: '',
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
    const [departmentSearch, setDepartmentSearch] = useState('');
    const [categorySearch, setCategorySearch] = useState('');
    const [categories, setCategories] = useState([]);
    const [isLoadingCategories, setIsLoadingCategories] = useState(false);

    // Add Category Modal
    const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [selectedColor, setSelectedColor] = useState('#10b981'); // Default emerald
    const [holidays, setHolidays] = useState([]);
    const [weeklyOffs, setWeeklyOffs] = useState([]);
    const categoryColors = [
        '#e11d48', '#c026d3', '#9333ea', '#7c3aed', '#4f46e5',
        '#2563eb', '#0284c7', '#0891b2', '#0d9488', '#059669',
        '#16a34a', '#65a30d', '#ca8a04', '#d97706', '#ea580c',
        '#dc2626', '#4b5563', '#1f2937'
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
    const [voiceState, setVoiceState] = useState('idle'); // 'idle' | 'recording' | 'recorded'
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
            fetchNotificationSettings();

            if (initialData) {
                // Determine if this is an "edit" (has ID) or "template" (no ID)
                const isEdit = !!initialData.id;
                const normalized = normalizeTaskForForm(initialData);

                setFormData(normalized);

                // Handle checklist
                if (initialData.checklistItems) {
                    const parsed = typeof initialData.checklistItems === 'string'
                        ? JSON.parse(initialData.checklistItems)
                        : initialData.checklistItems;

                    setChecklistItems(parsed.map((item, idx) => ({
                        id: Date.now() + idx,
                        text: item.itemName || item.text || '',
                        completed: item.completed || false
                    })));
                    setChecklistExpanded(parsed.length > 0);
                }

                // Handle Reminders
                if (initialData.reminders) {
                    const parsedReminders = typeof initialData.reminders === 'string' ? JSON.parse(initialData.reminders) : initialData.reminders;
                    setReminders(Array.isArray(parsedReminders) ? parsedReminders.map((r, idx) => ({
                        id: r.id || Date.now() + idx,
                        ...r,
                        timeValue: r.timeValue?.toString() || '10'
                    })) : []);
                }

                // Handle Attachments (referenceDocs is often a comma-separated string)
                if (initialData.referenceDocs && typeof initialData.referenceDocs === 'string') {
                    setLinks(initialData.referenceDocs.split(',').filter(Boolean));
                } else if (initialData.reference_docs && typeof initialData.reference_docs === 'string') {
                    setLinks(initialData.reference_docs.split(',').filter(Boolean));
                } else if (Array.isArray(initialData.referenceDocs)) {
                    setLinks(initialData.referenceDocs);
                } else if (Array.isArray(initialData.reference_docs)) {
                    setLinks(initialData.reference_docs);
                }
            } else {
                const storedUser = JSON.parse(localStorage.getItem('user'));
                const currentId = storedUser?.user?.id || storedUser?.id;
                setFormData({
                    taskTitle: '',
                    description: '',
                    doerId: isMyTask && currentId ? [currentId] : [],
                    department: '',
                    category: '',
                    priority: 'Low',
                    dueDate: null,
                    evidenceRequired: false,
                    inLoopIds: [],
                });
                setChecklistItems([]);
                setChecklistExpanded(false);
            }

            setError(null);
            setActiveDropdown(null);
            setActiveModal(null);
            setLinks([]);
            setNewLinkText('');
            setRepeatMode('Daily');
            setRepeatEndDate('');
            setRepeatStartDate(new Date().toISOString().split('T')[0]);
            fetchHolidays();
            setDepartmentSearch('');
            setRepeatIntervalDays('1');
            setOccurEveryMode('Week');
            setCustomOccurValue('1');
            setWeeklyDays([]);
            setSelectedDates([]);
            setCustomOccurDays([]);
            setCustomOccurDates([]);
            setVoiceState('idle');
            setRecordingTime(0);
            setAudioBlob(null);
            audioChunksRef.current = [];
        }
    }, [isOpen, initialData, isMyTask]);

    useEffect(() => {
        if (isOpen && departments.length === 0) {
            dispatch(fetchDepartments());
        }
    }, [isOpen, departments.length, dispatch]);

    const fetchUsers = async () => {
        try {
            setIsLoadingUsers(true);
            let data;
            if (groupId) {
                const response = await delegationService.getGroupMembers(groupId);
                data = response.data || response || [];
            } else {
                const response = await teamService.getUsers();
                data = Array.isArray(response) ? response : (response.data || response || []);
            }
            setUsers(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch users:', err);
            setUsers([]);
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const fetchHolidays = async () => {
        try {
            const data = await holidayService.getHolidays();
            setHolidays(data);
        } catch (err) {
            console.error('Failed to fetch holidays:', err);
        }
    };

    const fetchNotificationSettings = async () => {
        try {
            const response = await notificationService.getSettings();
            if (response?.success && response.data?.weeklyOffs) {
                setWeeklyOffs(response.data.weeklyOffs);
            }
        } catch (err) {
            console.error('Failed to fetch notification settings:', err);
        }
    };

    const fetchCategories = async () => {
        try {
            setIsLoadingCategories(true);
            const data = await delegationService.getCategories();
            setCategories(data);
        } catch (err) {
            console.error('Failed to fetch categories:', err);
        } finally {
            setIsLoadingCategories(false);
        }
    };

    const handleSaveCategory = async () => {
        if (!newCategoryName.trim()) return;
        try {
            const newCat = await delegationService.createCategory({
                name: newCategoryName.trim(),
                color: selectedColor
            });
            setCategories([newCat, ...categories]);
            setFormData(prev => ({ ...prev, category: newCat.name }));
            setIsAddCategoryModalOpen(false);
            setNewCategoryName('');
            setActiveDropdown(null);
        } catch (err) {
            console.error('Failed to create category:', err);
            setError('Failed to create category');
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    // UI Toggles
    const toggleModal = (modal, target = 'dueDate') => {
        const isClosing = activeModal === modal && (modal !== 'date' || dateTarget === target);
        setActiveModal(isClosing ? null : modal);

        if (modal === 'date') {
            setDateTarget(target);
            setDatePickerView('date');

            let initialDate;
            if (target === 'dueDate') {
                initialDate = formData.dueDate;
            } else if (target === 'repeatStartDate') {
                initialDate = repeatStartDate ? new Date(repeatStartDate) : new Date();
            } else if (target === 'repeatEndDate') {
                initialDate = repeatEndDate ? new Date(repeatEndDate) : new Date();
            }

            if (initialDate && initialDate instanceof Date && !isNaN(initialDate)) {
                setTempSelectedDate(initialDate);
                setCurrentCalMonth(initialDate);
                let h = initialDate.getHours();
                const m = initialDate.getMinutes().toString().padStart(2, '0');
                const ampm = h >= 12 ? 'PM' : 'AM';
                h = h % 12 || 12;
                setTempSelectedTime({ hours: h.toString().padStart(2, '0'), minutes: m, ampm });
            } else if (typeof initialDate === 'string' && initialDate) {
                const parsed = new Date(initialDate);
                if (!isNaN(parsed)) {
                    setTempSelectedDate(parsed);
                    setCurrentCalMonth(parsed);
                    setTempSelectedTime({ hours: '12', minutes: '00', ampm: 'PM' });
                }
            } else {
                setTempSelectedDate(new Date());
                setCurrentCalMonth(new Date());
                setTempSelectedTime({ hours: '12', minutes: '00', ampm: 'PM' });
            }
        }
    };

    const openModal = (modalName) => {
        setActiveDropdown(null);
        setActiveModal(modalName);
        if (modalName === 'checklist') {
            setChecklistExpanded(true);
            setTimeout(() => {
                document.getElementById('checklist-input')?.focus();
            }, 100);
        }
    };

    const toggleUserSelect = (userId, field) => {
        setFormData(prev => {
            const list = Array.isArray(prev[field]) ? prev[field] : [];
            // Use String comparison to handle ID type mismatches (int vs string)
            const exists = list.some(id => String(id) === String(userId));
            if (exists) {
                return { ...prev, [field]: list.filter(id => String(id) !== String(userId)) };
            }
            return { ...prev, [field]: [...list, userId] };
        });
    };

    const addCategory = () => {
        setIsAddCategoryModalOpen(true);
    };

    // Reusable Actions Modal Wrapper
    const handleAddChecklistItem = (e) => {
        if (e.key === 'Enter' && newChecklistText.trim()) {
            setChecklistItems([...checklistItems, { id: Date.now(), text: newChecklistText.trim(), completed: false }]);
            setNewChecklistText('');
        }
    };

    const toggleChecklistItem = (id) => {
        setChecklistItems(items => items.map(item => item.id === id ? { ...item, completed: !item.completed } : item));
    };

    const removeChecklistItem = (id) => {
        setChecklistItems(items => items.filter(item => item.id !== id));
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            
            // Check file sizes
            const oversized = newFiles.filter(f => f.size > 50 * 1024 * 1024);
            if (oversized.length > 0) {
                toast.error(`Some files exceed the 50MB limit: ${oversized.map(f => f.name).join(', ')}`);
                return;
            }

            setAttachments(prev => [...prev, ...newFiles]);
        }
    };

    const addReminder = () => {
        setReminders([...reminders, {
            id: Date.now(),
            medium: 'WhatsApp',
            timingValue: '10',
            timingUnit: 'minutes',
            timingRelation: 'Before'
        }]);
    };

    const updateReminder = (id, field, value) => {
        setReminders(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const removeReminder = (id) => {
        setReminders(prev => prev.filter(r => r.id !== id));
    };

    const renderEmptyState = () => (
        <div className="flex flex-col items-center justify-center p-6 text-center select-none">
            <div className="relative mb-6">
                <div className="w-[72px] h-[88px] bg-slate-100 rounded-xl shadow-inner absolute -left-5 -rotate-6"></div>
                <div className="w-[72px] h-[88px] bg-bg-card rounded-xl shadow-lg border border-border-main p-2.5 flex flex-col gap-2 z-10 relative">
                    <div className="w-full h-1.5 bg-slate-200 rounded-full"></div>
                    <div className="w-3/4 h-1.5 bg-slate-200 rounded-full"></div>
                    <div className="w-1/2 h-1.5 bg-slate-200 rounded-full"></div>
                    <div className="w-full h-2 bg-emerald-100/50 rounded-full mt-auto"></div>
                </div>
                <div className="absolute -bottom-3 -right-3 w-[46px] h-[46px] bg-emerald-500 rounded-full flex items-center justify-center z-20 shadow-xl border-4 border-[#1e2329]">
                    <Search size={22} className="text-white" strokeWidth={3} />
                </div>
                <div className="absolute top-1 -left-8 text-white">
                    <X size={12} strokeWidth={4} />
                </div>
                <div className="absolute -top-3 right-8 text-white">
                    <X size={8} strokeWidth={4} />
                </div>
            </div>
            <div className="text-text-muted font-bold text-[15px] mt-2">No User found</div>
        </div>
    );

    const toggleVoiceRecord = () => {
        setIsRecording(!isRecording);
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        try {
            setIsSubmitting(true);
            setError(null);

            const storedUser = JSON.parse(localStorage.getItem('user'));
            const assignerId = storedUser?.user?.id || storedUser?.id;

            if (!assignerId) throw new Error('User not authenticated');
            if (!formData.taskTitle.trim()) throw new Error('Task Title is required');
            if (!formData.description.trim()) throw new Error('Task Description is required');
            if (formData.doerId.length === 0) throw new Error('Assignee is required');
            if (!formData.dueDate) throw new Error('Due Date is required');
            if (!formData.category) throw new Error('Category is required');


            if (!formData.priority) throw new Error('Priority is required');


            let submissionDueDate = null;
            if (formData.dueDate) {
                try {
                    submissionDueDate = new Date(formData.dueDate).toISOString();
                } catch (e) {
                    console.error("Invalid due date:", formData.dueDate);
                }
            }

            const formDataToSend = new FormData();
            
            // Append basic fields
            formDataToSend.append('taskTitle', formData.taskTitle);
            formDataToSend.append('description', formData.description);
            formDataToSend.append('assignerId', assignerId);
            formDataToSend.append('assignerName', storedUser?.user?.name || storedUser?.name || 'Unknown');
            formDataToSend.append('department', formData.department || '');
            formDataToSend.append('priority', formData.priority);
            formDataToSend.append('dueDate', submissionDueDate || '');
            formDataToSend.append('evidenceRequired', formData.evidenceRequired);
            formDataToSend.append('category', formData.category);
            formDataToSend.append('groupId', groupId || '');
            formDataToSend.append('parentId', parentId || '');

            // Append complex objects as JSON strings
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

            try {
                if (isEdit) {
                    if (apiMode === 'delegation') {
                        await delegationService.updateDelegation(initialData.id, formDataToSend);
                    } else {
                        await taskService.updateTask(initialData.id, formDataToSend);
                    }
                    toast.success('Task updated successfully!');
                } else {
                    if (apiMode === 'delegation') {
                        await delegationService.createDelegation(formDataToSend);
                    } else {
                        await taskService.createTask(formDataToSend);
                    }
                    toast.success('Task created and assigned successfully!');
                }

                onSuccess?.();
                onClose();
            } catch (err) {
                console.error('API Error details:', err.response?.data);
                toast.error(err.response?.data?.message || `Failed to ${isEdit ? 'update' : 'assign'} task`);
                throw err;
            }
        } catch (err) {
            console.error('Failed to create task:', err);
            setError(err.message || err.response?.data?.message || 'Failed to create task');
            toast.error(err.message || 'Failed to create task');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const filteredUsers = (Array.isArray(users) ? users : []).filter(u => {
        if (!u) return false;
        const search = (userSearch || '').toLowerCase();
        const firstName = u.firstName || u.first_name || '';
        const lastName = u.lastName || u.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim().toLowerCase();
        const email = (u.email || u.workEmail || u.work_email || '').toLowerCase();
        const isActive = u.status ? u.status.toLowerCase() === 'active' : true;
        return isActive && (fullName.includes(search) || email.includes(search));
    });

    const filteredLoopUsers = (Array.isArray(users) ? users : []).filter(u => {
        if (!u) return false;
        const search = (loopSearch || '').toLowerCase();
        const firstName = u.firstName || u.first_name || '';
        const lastName = u.lastName || u.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim().toLowerCase();
        const email = (u.email || u.workEmail || u.work_email || '').toLowerCase();
        const isActive = u.status ? u.status.toLowerCase() === 'active' : true;
        return isActive && (fullName.includes(search) || email.includes(search));
    });

    const filteredCategories = Array.isArray(categories) ? categories.filter(c =>
        (c && c.name && typeof c.name === 'string' ? c.name : '').toLowerCase().includes((categorySearch || '').toLowerCase())
    ) : [];
    const filteredDepartments = Array.isArray(departments) ? departments.filter(d =>
        (d && d.name && typeof d.name === 'string' ? d.name : '').toLowerCase().includes((departmentSearch || '').toLowerCase())
    ) : [];

    const isSameDate = (d1, d2) => d1 && d2 && d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();

    return (
        <div className="fixed inset-0 z-[70] flex p-0 sm:p-4 lg:p-8 pt-0 sm:pt-[5vh] justify-center items-start animate-in fade-in duration-300 overflow-hidden">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-[680px] sm:mt-0 h-full sm:h-auto max-h-screen sm:max-h-[92vh] bg-bg-card sm:rounded-2xl shadow-[0_20px_70px_rgba(0,0,0,0.15)]  border border-border-main animate-in zoom-in-95 duration-300 flex flex-col overflow-visible">

                {/* Brand Accent Line */}
                {/* <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-500 via-emerald-400 to-[#f97316] z-20" /> */}

                <div className="flex items-center justify-between px-4 py-2 border-b border-border-main bg-[#e6f9f1] relative sm:rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00d094] to-[#00b882] flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Plus size={16} className="text-white" strokeWidth={3} />
                        </div>
                        <div>
                            <h2 className="text-xs font-bold text-text-main leading-tight">{initialData?.id ? 'Update Task' : (isMyTask ? 'Add New Task' : 'Assign New Task')}</h2>
                            <p className="text-[8px] text-emerald-600 font-bold uppercase tracking-widest opacity-80">{initialData?.id ? (isMyTask ? 'Update Task' : 'Update Delegation') : (isMyTask ? 'PERSONAL TASK' : 'NEW DELEGATION')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-emerald-500 hover:bg-emerald-50 transition-all">
                        <X size={16} strokeWidth={2.5} />
                    </button>
                </div>

                {error && (
                    <div className="mx-5 mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm flex items-center gap-3 animate-in slide-in-from-top-2 duration-200">
                        <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                            <AlertCircle size={14} />
                        </div>
                        {error}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0 bg-bg-card">
                    <div className="border-b border-slate-50 p-3 bg-emerald-50/10">
                        <input
                            type="text"
                            name="taskTitle"
                            value={formData.taskTitle}
                            onChange={handleChange}
                            placeholder="Add Task Title *..."
                            className="w-full bg-transparent text-sm font-bold text-text-main placeholder:text-slate-300 outline-none transition-all focus:placeholder:text-text-muted"
                            autoFocus
                        />
                    </div>
                    <div className="border-b border-slate-50 p-3 w-full min-h-[100px]">
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            placeholder="Write task details, instructions or goals here *..."
                            className="w-full h-full min-h-[70px] bg-transparent text-[11px] font-medium text-text-muted placeholder:text-slate-300 outline-none resize-none leading-relaxed"
                        />
                    </div>

                    {/* Checklist Section */}
                    <div className="border-b border-slate-50 transition-all bg-bg-main/30">
                        <div
                            className="p-2.5 text-emerald-600 font-bold text-[10px] cursor-pointer hover:text-emerald-700 transition-colors flex items-center justify-between uppercase tracking-widest"
                            onClick={() => {
                                setChecklistExpanded(!checklistExpanded);
                                if (!checklistExpanded) setTimeout(() => document.getElementById('checklist-input')?.focus(), 100);
                            }}
                        >
                            <span className="flex items-center gap-2">
                                <Plus size={14} strokeWidth={3} />
                                Add Checklist
                            </span>
                            <ChevronDown size={12} className={`text-text-muted transition-transform ${checklistExpanded ? 'rotate-180' : ''}`} />
                        </div>

                        {checklistExpanded && (
                            <div className="px-5 pb-4 animate-in slide-in-from-top-2 duration-300">
                                <div className="space-y-2 mb-3 mt-1">
                                    {checklistItems.map(item => (
                                        <div key={item.id} className="flex items-center gap-2.5 group">
                                            <button
                                                onClick={() => toggleChecklistItem(item.id)}
                                                className={`shrink-0 w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${item.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-bg-card hover:border-emerald-500'}`}
                                            >
                                                {item.completed && <Check size={10} strokeWidth={4} />}
                                            </button>
                                            <span className={`text-[11px] font-bold leading-snug flex-1 ${item.completed ? 'text-text-muted line-through' : 'text-text-main'}`}>
                                                {item.text}
                                            </span>
                                            <button onClick={() => removeChecklistItem(item.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0 p-1">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-bg-card rounded-xl border border-border-main p-2 flex items-center gap-2.5 focus-within:border-emerald-500/30 transition-all shadow-sm">
                                    <input
                                        id="checklist-input"
                                        type="text"
                                        placeholder="Add more tasks to checklist..."
                                        value={newChecklistText}
                                        onChange={e => setNewChecklistText(e.target.value)}
                                        onKeyDown={handleAddChecklistItem}
                                        className="bg-transparent text-[11px] font-bold text-text-main placeholder:text-slate-300 outline-none w-full px-2"
                                    />
                                    <button
                                        onClick={() => handleAddChecklistItem({ key: 'Enter' })}
                                        className="bg-emerald-500 hover:bg-emerald-600 text-white p-1 rounded-lg shadow-md shadow-emerald-500/20 transition-all active:scale-95"
                                    >
                                        <Plus size={14} strokeWidth={3} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-3 flex flex-wrap items-center gap-1.5 border-b border-slate-50 relative bg-emerald-50/5">
                        {/* 1. Users */}
                        <div className="relative">
                            <button 
                                type="button"
                                onClick={() => toggleModal('users')} 
                                className={`flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg border-2 text-[8px] font-bold transition-all shadow-sm uppercase tracking-wide ${formData.doerId.length > 0 ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-border-main bg-bg-card text-text-muted hover:border-emerald-500/30'}`}
                            >
                                <Users size={14} className={formData.doerId.length > 0 ? "text-emerald-500" : "text-slate-300"} />
                                {isLoadingUsers ? 'Loading...' : formData.doerId.length > 0 ? `${formData.doerId.length} Selected` : 'Assignee *'}
                            </button>
                        </div>

                        {/* 2. Due Date */}
                        <div className="relative group">
                            <button 
                                type="button"
                                onClick={() => toggleModal('date')} 
                                className={`flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg border-2 text-[8px] font-bold transition-all shadow-sm uppercase tracking-wide ${formData.dueDate ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-border-main bg-bg-card text-text-muted hover:border-emerald-500/30'}`}
                            >
                                <CalendarIcon size={14} className={formData.dueDate ? "text-emerald-500" : "text-slate-300"} />
                                {formData.dueDate ? new Date(formData.dueDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Set Deadline'}
                            </button>
                        </div>

                        {/* 3. Department */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => toggleModal('department')}
                                className={`flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg border-2 text-[8px] font-bold transition-all shadow-sm uppercase tracking-wide ${formData.department ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-border-main bg-bg-card text-text-muted hover:border-emerald-500/30'}`}
                            >
                                <Building2 size={14} className={formData.department ? "text-emerald-500" : "text-slate-300"} />
                                {formData.department || 'Department'}
                            </button>
                        </div>

                        {/* 4. Priority */}
                        <div className="relative">
                            <button onClick={(e) => { e.stopPropagation(); setActiveDropdown(prev => prev === 'priority' ? null : 'priority'); }} className={`flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg border-2 text-[8px] font-bold transition-all shadow-sm uppercase tracking-wide ${formData.priority === 'High' ? 'border-red-500 bg-red-50 text-red-600' : formData.priority === 'Medium' ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-emerald-500 bg-emerald-50 text-emerald-600'}`}>
                                <Flag size={14} className={formData.priority === 'High' ? 'text-red-500' : formData.priority === 'Medium' ? 'text-orange-500' : 'text-emerald-500'} />
                                {formData.priority} *
                            </button>
                            {activeDropdown === 'priority' && (
                                <div className="absolute top-[calc(100%+8px)] left-0 w-[150px] bg-bg-card border border-border-main rounded-2xl shadow-xl z-[100] flex flex-col p-2 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
                                    {['High', 'Medium', 'Low'].map(p => (
                                        <button key={p} onClick={() => { setFormData(prev => ({ ...prev, priority: p })); setActiveDropdown(null); }} className={`text-left px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all ${formData.priority === p ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'text-text-muted hover:bg-emerald-50 hover:text-emerald-600'}`}>
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 5. Category */}
                        <div className="relative">
                            <button 
                                type="button"
                                onClick={() => toggleModal('category')} 
                                className={`flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg border-2 text-[8px] font-bold transition-all shadow-sm uppercase tracking-wide ${formData.category ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-border-main bg-bg-card text-text-muted hover:border-emerald-500/30'}`}
                            >
                                <CheckSquare size={14} className={formData.category ? "text-emerald-500" : "text-slate-300"} />
                                {formData.category || 'Category *'}
                            </button>
                        </div>

                        {/* 6. In Loop */}
                        <div className="relative">
                            <button 
                                type="button"
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    toggleModal('inLoop'); 
                                }} 
                                className={`flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg border-2 text-[8px] font-bold transition-all shadow-sm uppercase tracking-wide ${formData.inLoopIds.length > 0 ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-border-main bg-bg-card text-text-muted hover:border-emerald-500/30'}`}
                            >
                                <Users size={14} className={formData.inLoopIds.length > 0 ? "text-emerald-500" : "text-slate-300"} />
                                {formData.inLoopIds.length > 0 ? `${formData.inLoopIds.length} in Loop` : 'In Loop'}
                            </button>
                        </div>

                        {/* 7. Evidence Required */}
                        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg border-2 border-border-main bg-bg-card text-text-muted hover:border-emerald-500/30 transition-all shadow-sm">
                            <label className="flex items-center gap-1.5 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        name="evidenceRequired"
                                        checked={formData.evidenceRequired}
                                        onChange={handleChange}
                                        className="peer h-3.5 w-3.5 bg-bg-card border-2 border-border-main rounded-md checked:bg-emerald-500 checked:border-emerald-500 transition-all cursor-pointer opacity-0 absolute inset-0 z-10"
                                    />
                                    <div className="h-3.5 w-3.5 bg-bg-card border-2 border-border-main rounded-md peer-checked:bg-emerald-500 peer-checked:border-emerald-500 flex items-center justify-center transition-all">
                                        {formData.evidenceRequired && <Check size={8} className="text-white" strokeWidth={4} />}
                                    </div>
                                </div>
                                <span className={`text-[8px] font-bold uppercase tracking-wide transition-colors ${formData.evidenceRequired ? 'text-emerald-600' : 'text-text-muted group-hover:text-text-muted'}`}>Evidence</span>
                            </label>
                        </div>
                    </div>

                    {/* Repeat Task Section - Moved into scroll area */}
                    <div className="flex flex-col gap-2.5 p-3.5 bg-bg-main rounded-2xl border border-border-main mx-4 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        {/* Repeat Mode Selection & Dates */}
                        <div className="flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input type="checkbox" checked={isRepeat} onChange={(e) => setIsRepeat(e.target.checked)} className="peer h-3.5 w-3.5 bg-bg-card border-2 border-border-main rounded-md checked:bg-emerald-500 checked:border-emerald-500 transition-all cursor-pointer opacity-0 absolute inset-0 z-10" />
                                    <div className="h-3.5 w-3.5 bg-bg-card border-2 border-border-main rounded-md peer-checked:bg-emerald-500 peer-checked:border-emerald-500 flex items-center justify-center transition-all">
                                        {isRepeat && <Check size={8} className="text-white" strokeWidth={4} />}
                                    </div>
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-wide transition-colors ${isRepeat ? 'text-emerald-600' : 'text-text-muted group-hover:text-text-muted'}`}>Repeat</span>
                            </label>

                            {isRepeat && (
                                <>
                                    <div className="relative">
                                        <button onClick={() => toggleDropdown('repeatMode')} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 border-border-main bg-bg-card text-[9px] font-black text-text-main hover:border-emerald-500/30 transition-all shadow-sm uppercase tracking-wide">
                                            {repeatMode} <ChevronDown size={10} className="text-slate-300" />
                                        </button>
                                        {activeDropdown === 'repeatMode' && (
                                            <div className="absolute top-[calc(100%+8px)] left-0 w-36 bg-bg-card border border-border-main rounded-2xl shadow-xl z-[100] flex flex-col p-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                                                {['Daily', 'Weekly', 'Monthly', 'Yearly', 'Periodically', 'Custom'].map(mode => (
                                                    <button key={mode} onClick={() => { setRepeatMode(mode); setActiveDropdown(null); }} className={`text-left px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all ${repeatMode === mode ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'text-text-muted hover:bg-emerald-50 hover:text-emerald-600'}`}>
                                                        {mode}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1.5 relative">
                                        <div className="relative">
                                            <button onClick={() => toggleModal('date', 'repeatStartDate')} className="flex items-center bg-bg-card border-2 border-border-main rounded-lg px-2.5 py-1 hover:border-emerald-500/30 transition-all shadow-sm group">
                                                <CalendarIcon size={12} className="text-slate-300 group-hover:text-emerald-500 mr-1.5 shrink-0 transition-colors" />
                                                <span className="text-[9px] font-black text-text-main uppercase tracking-tighter w-[60px] text-left">
                                                    {repeatStartDate ? new Date(repeatStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Start Date'}
                                                </span>
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <button onClick={() => toggleModal('date', 'repeatEndDate')} className="flex items-center bg-bg-card border-2 border-border-main rounded-lg px-2.5 py-1 hover:border-emerald-500/30 transition-all shadow-sm group">
                                                <CalendarIcon size={12} className="text-slate-300 group-hover:text-emerald-500 mr-1.5 shrink-0 transition-colors" />
                                                <span className="text-[9px] font-black text-text-main uppercase tracking-tighter w-[60px] text-left">
                                                    {repeatEndDate ? new Date(repeatEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'End Date'}
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Mode-Specific Options */}
                        {isRepeat && (
                            <div className="border-t border-border-main pt-5 flex flex-col gap-5">
                                {repeatMode === 'Weekly' && (
                                    <div className="flex flex-wrap gap-2">
                                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                                            const isSelected = weeklyDays.includes(day);
                                            return (
                                                <button key={day} onClick={() => setWeeklyDays(prev => isSelected ? prev.filter(d => d !== day) : [...prev, day])} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all border-2 ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' : 'bg-bg-card border-border-main text-text-muted hover:border-emerald-500/30'}`}>
                                                    {day.substring(0, 3)}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}

                                {repeatMode === 'Monthly' && (
                                    <div className="grid grid-cols-7 sm:grid-cols-10 gap-1.5">
                                        {[...Array(31)].map((_, i) => {
                                            const d = (i + 1).toString().padStart(2, '0');
                                            const isSelected = selectedDates.includes(d);
                                            return (
                                                <button key={d} onClick={() => setSelectedDates(prev => isSelected ? prev.filter(dt => dt !== d) : [...prev, d])} className={`w-8 h-8 flex items-center justify-center rounded-lg text-[10px] font-black transition-all border-2 ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' : 'bg-bg-card border-border-main text-text-muted hover:border-emerald-500/30'}`}>
                                                    {i + 1}
                                                </button>
                                            )
                                        })}
                                        <button onClick={() => setSelectedDates(prev => prev.includes('Last Day') ? prev.filter(d => d !== 'Last Day') : [...prev, 'Last Day'])} className={`col-span-2 px-2 h-8 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all border-2 ${selectedDates.includes('Last Day') ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' : 'bg-bg-card border-border-main text-text-muted hover:border-emerald-500/30'}`}>
                                            Last Day
                                        </button>
                                    </div>
                                )}

                                {repeatMode === 'Periodically' && (
                                    <div className="flex items-center gap-3">
                                        <span className="text-[11px] font-black text-text-muted uppercase tracking-widest">Repeat every</span>
                                        <div className="flex items-center bg-bg-card border-2 border-border-main rounded-xl px-3 py-1.5 focus-within:border-emerald-500/30 transition-all w-28 shadow-sm">
                                            <input type="number" min="1" value={repeatIntervalDays} onChange={(e) => setRepeatIntervalDays(e.target.value)} className="bg-transparent text-[12px] text-text-main font-black outline-none w-full" />
                                            <span className="text-[9px] text-emerald-600 font-black uppercase ml-1.5">Days</span>
                                        </div>
                                    </div>
                                )}

                                {repeatMode === 'Custom' && (
                                    <div className="flex flex-col gap-5 p-5 bg-bg-card border-2 border-border-main rounded-[24px] shadow-sm">
                                        <div className="flex items-center gap-4 flex-wrap">
                                            <span className="text-[13px] font-black text-text-muted uppercase tracking-widest">Occur every</span>
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <button onClick={() => toggleDropdown('customOccurValue')} className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border-2 border-border-main bg-bg-main text-[13px] font-black text-text-main">
                                                        {customOccurValue} <ChevronDown size={14} className="text-slate-300" />
                                                    </button>
                                                    {activeDropdown === 'customOccurValue' && (
                                                        <div className="absolute top-[calc(100%+8px)] left-0 w-24 max-h-48 overflow-y-auto bg-bg-card border border-border-main rounded-2xl shadow-xl z-[110] flex flex-col p-1.5 animate-in fade-in slide-in-from-top-2">
                                                            {[...Array(occurEveryMode === 'Week' ? 52 : 12)].map((_, i) => (
                                                                <button key={i} onClick={() => { setCustomOccurValue((i + 1).toString()); setActiveDropdown(null); }} className={`text-left px-3 py-2 rounded-lg text-[13px] font-black transition-all ${customOccurValue === (i + 1).toString() ? 'bg-emerald-500 text-white shadow-sm' : 'text-text-muted hover:bg-emerald-50'}`}>
                                                                    {i + 1}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="relative">
                                                    <button onClick={() => toggleDropdown('occurEveryMode')} className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border-2 border-border-main bg-bg-main text-[13px] font-black text-text-main">
                                                        {occurEveryMode}{parseInt(customOccurValue) > 1 ? 's' : ''} <ChevronDown size={14} className="text-slate-300" />
                                                    </button>
                                                    {activeDropdown === 'occurEveryMode' && (
                                                        <div className="absolute top-[calc(100%+8px)] left-0 w-36 bg-bg-card border border-border-main rounded-2xl shadow-xl z-[110] flex flex-col p-1.5 animate-in fade-in slide-in-from-top-2">
                                                            {['Week', 'Month'].map(m => (
                                                                <button key={m} onClick={() => { setOccurEveryMode(m); setActiveDropdown(null); }} className={`text-left px-4 py-2.5 rounded-xl text-[13px] font-black transition-all ${occurEveryMode === m ? 'bg-emerald-500 text-white shadow-sm' : 'text-text-muted hover:bg-emerald-50'}`}>
                                                                    {m}{parseInt(customOccurValue) > 1 ? 's' : ''}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-4">
                                            <span className="text-[12px] font-black text-text-muted uppercase tracking-widest">Select {occurEveryMode === 'Week' ? 'Days' : 'Dates'} :</span>
                                            {occurEveryMode === 'Week' ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                                                        const isSelected = customOccurDays.includes(day);
                                                        return (
                                                            <button key={day} onClick={() => setCustomOccurDays(prev => isSelected ? prev.filter(d => d !== day) : [...prev, day])} className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all border-2 ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' : 'bg-bg-card border-border-main text-text-muted hover:border-emerald-500/30'}`}>
                                                                {day.substring(0, 3)}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-7 sm:grid-cols-10 gap-1.5">
                                                    {[...Array(31)].map((_, i) => {
                                                        const d = (i + 1).toString();
                                                        const isSelected = customOccurDates.includes(d);
                                                        return (
                                                            <button key={d} onClick={() => setCustomOccurDates(prev => isSelected ? prev.filter(dt => dt !== d) : [...prev, d])} className={`w-8.5 h-8.5 flex items-center justify-center rounded-xl text-[11px] font-black transition-all border-2 ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-bg-card border-border-main text-text-muted hover:border-emerald-500/30'}`}>
                                                                {i + 1}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Links & Attachments Display Container */}
                    <div className="flex flex-col gap-3 px-6 pb-6 animate-in fade-in duration-300">
                        {links.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {links.map((link, i) => (
                                    <div key={i} className="flex items-center gap-2.5 bg-emerald-50/50 border-2 border-emerald-100/50 px-3.5 py-1.5 rounded-xl text-[12px] font-black text-emerald-700 shadow-sm max-w-[300px]">
                                        <Globe size={14} className="text-emerald-500 shrink-0" strokeWidth={3} /> <span className="truncate flex-1 tracking-tight">{link}</span>
                                        <button onClick={() => setLinks(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-500 transition-colors ml-1 shrink-0"><X size={14} strokeWidth={4} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {attachments.map((file, i) => (
                                    <div key={i} className="flex items-center gap-2.5 bg-bg-main border-2 border-border-main px-3.5 py-1.5 rounded-xl text-[12px] font-black text-text-main shadow-sm max-w-[220px]">
                                        {file.type?.startsWith('image/') ? <ImageIcon size={14} className="text-emerald-500 shrink-0" strokeWidth={3} /> : <Paperclip size={14} className="text-emerald-500 shrink-0" strokeWidth={3} />}
                                        <span className="truncate flex-1 tracking-tight">{file.name}</span>
                                        <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-500 transition-colors ml-1 shrink-0"><X size={14} strokeWidth={4} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Fixed Footer */}
                <div className="p-3 flex items-center justify-between border-t border-border-main bg-bg-card sm:rounded-b-2xl relative shrink-0 z-10">
                    <div className="flex items-center gap-1 text-text-muted">
                        {/* Attachment Icon */}
                        <div className="relative">
                            <button
                                onClick={(e) => { e.stopPropagation(); openModal('attachment'); }}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${attachments.length > 0 ? 'text-emerald-600 bg-emerald-50 shadow-sm' : 'text-text-muted hover:text-emerald-500 hover:bg-emerald-50/50'}`}
                                title="Attach Files"
                            >
                                <Paperclip size={16} strokeWidth={2.5} />
                            </button>
                            {attachments.length > 0 && (
                                <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full flex items-center justify-center text-[8px] font-black text-white border-2 border-white shadow-lg">
                                    {attachments.length}
                                </div>
                            )}
                        </div>

                        {/* Reminders Icon */}
                        <div className="relative">
                            <button
                                onClick={(e) => { e.stopPropagation(); openModal('reminder'); }}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${reminders.length > 0 ? 'text-emerald-600 bg-emerald-50 shadow-sm' : 'text-text-muted hover:text-emerald-500 hover:bg-emerald-50/50'}`}
                                title="Add Reminder"
                            >
                                <Clock size={16} strokeWidth={2.5} />
                            </button>
                            {reminders.length > 0 && (
                                <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-emerald-500 rounded-full border border-white shadow-lg"></div>
                            )}
                        </div>

                        {/* Voice Icon */}
                        <div className="relative">
                            <button
                                onClick={(e) => { e.stopPropagation(); openModal('voice'); }}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${voiceState === 'recorded' ? 'text-emerald-600 bg-emerald-50 shadow-sm' : 'text-text-muted hover:text-emerald-500 hover:bg-emerald-50/50'}`}
                                title="Add Voice Note"
                            >
                                <Mic size={16} strokeWidth={2.5} />
                            </button>
                            {voiceState === 'recorded' && (
                                <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-emerald-500 rounded-full border border-white shadow-lg"></div>
                            )}
                        </div>

                        {/* More Options */}
                        <div className="relative ml-1 pl-2.5 border-l border-border-main h-6 flex items-center">
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleDropdown('moreOptions'); }}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${activeDropdown === 'moreOptions' ? 'text-text-main bg-slate-100' : 'text-text-muted hover:text-text-main hover:bg-bg-main'}`}
                            >
                                <div className="flex items-center justify-center -translate-y-1"><span className="text-xl font-black">...</span></div>
                            </button>

                            {activeDropdown === 'moreOptions' && (
                                <div className="absolute bottom-[calc(100%+12px)] left-0 w-52 bg-bg-card border border-border-main rounded-2xl shadow-[0_15px_60px_rgba(0,0,0,0.1)] z-[100] flex flex-col py-1.5 animate-in fade-in slide-in-from-bottom-3 duration-200">
                                    <div className="px-3.5 py-1 text-[8px] font-bold text-text-muted uppercase tracking-widest mb-1 opacity-60">Extra Options</div>
                                    <button onClick={() => openModal('link')} className="flex items-center justify-between px-3.5 py-2 hover:bg-emerald-50/50 text-[11px] font-bold text-text-main hover:text-emerald-600 transition-all">
                                        <span className="flex items-center gap-2.5"><Globe size={14} className="text-slate-300" strokeWidth={2.5} /> Add Link {links.length > 0 && <span className="bg-emerald-500 text-white w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px]">{links.length}</span>}</span>
                                    </button>
                                    <button onClick={() => { setActiveDropdown(null); fileInputRef.current?.click(); }} className="flex items-center justify-between px-3.5 py-2 hover:bg-emerald-50/50 text-[11px] font-bold text-text-main hover:text-emerald-600 transition-all">
                                        <span className="flex items-center gap-2.5"><Paperclip size={14} className="text-slate-300" strokeWidth={2.5} /> Add Attachment</span>
                                    </button>
                                    <button onClick={() => { setActiveDropdown(null); imageInputRef.current?.click(); }} className="flex items-center justify-between px-3.5 py-2 hover:bg-emerald-50/50 text-[11px] font-bold text-text-main hover:text-emerald-600 transition-all">
                                        <span className="flex items-center gap-2.5"><ImageIcon size={14} className="text-slate-300" strokeWidth={2.5} /> Upload Image</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="group relative px-5 py-2 bg-gradient-to-br from-[#00d094] to-[#00b882] hover:shadow-emerald-500/30 active:scale-95 text-white font-bold rounded-xl text-[11px] transition-all flex items-center gap-2 overflow-hidden shadow-[0_10px_25px_-5px_rgba(0,208,148,0.3)] disabled:opacity-50 uppercase tracking-widest"
                    >
                        <div className="absolute inset-0 bg-bg-card/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        {isSubmitting ? (
                            <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                            <div className="bg-bg-card/20 rounded-lg p-1 text-white group-hover:scale-110 group-hover:rotate-[360deg] transition-all duration-500">
                                <Upload size={14} strokeWidth={3} />
                            </div>
                        )}
                        <span className="relative">{isSubmitting ? 'Processing...' : (initialData?.id ? 'Update Task' : 'Assign Task')}</span>
                    </button>
                </div>

                {/* MODALS RENDERED HERE FOR CORRECT POPOVER POSITIONING */}
                {/* Date/Time Picker Modal */}
                {activeModal === 'date' && (
                    <ActionModal
                        title={`Select ${dateTarget === 'dueDate' ? 'Due Date' : dateTarget === 'repeatStartDate' ? 'Start Date' : 'End Date'}`}
                        onClose={() => setActiveModal(null)}
                        onSave={() => {
                            if (!tempSelectedDate) return;

                            const finalDate = new Date(tempSelectedDate);
                            if (dateTarget === 'dueDate') {
                                let h = parseInt(tempSelectedTime.hours);
                                if (tempSelectedTime.ampm === 'PM' && h < 12) h += 12;
                                if (tempSelectedTime.ampm === 'AM' && h === 12) h = 0;
                                finalDate.setHours(h, parseInt(tempSelectedTime.minutes), 0, 0);
                            } else {
                                finalDate.setHours(0, 0, 0, 0);
                            }

                            if (dateTarget === 'dueDate') {
                                setFormData(prev => ({ ...prev, dueDate: finalDate }));
                            } else if (dateTarget === 'repeatStartDate') {
                                setRepeatStartDate(finalDate.toISOString().split('T')[0]);
                            } else if (dateTarget === 'repeatEndDate') {
                                setRepeatEndDate(finalDate.toISOString().split('T')[0]);
                            }
                            setActiveModal(null);
                        }}
                        saveText="Done"
                    >
                        <div className="flex flex-col gap-6">
                            {/* Toggle between Date and Time - only for Due Date */}
                            {dateTarget === 'dueDate' && (
                                <div className="flex bg-slate-100 p-1.5 rounded-2xl self-center shadow-inner">
                                    <button
                                        onClick={() => setDatePickerView('date')}
                                        className={`px-8 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${datePickerView === 'date' ? 'bg-bg-card text-emerald-600 shadow-sm' : 'text-text-muted hover:text-text-muted'}`}
                                    >
                                        Date
                                    </button>
                                    <button
                                        onClick={() => setDatePickerView('time')}
                                        className={`px-8 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${datePickerView === 'time' ? 'bg-bg-card text-emerald-600 shadow-sm' : 'text-text-muted hover:text-text-muted'}`}
                                    >
                                        Time
                                    </button>
                                </div>
                            )}

                            {datePickerView === 'date' ? (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex items-center justify-between mb-6 px-2">
                                        <span className="text-[16px] font-black text-text-main uppercase tracking-widest bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100/50">
                                            {currentCalMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                        </span>
                                        <div className="flex gap-2">
                                            <button onClick={() => setCurrentCalMonth(new Date(currentCalMonth.getFullYear(), currentCalMonth.getMonth() - 1, 1))} className="w-10 h-10 rounded-xl bg-bg-card border-2 border-border-main flex items-center justify-center text-text-muted hover:text-emerald-500 hover:border-emerald-500/30 transition-all shadow-sm">
                                                <ChevronLeft size={20} strokeWidth={3} />
                                            </button>
                                            <button onClick={() => setCurrentCalMonth(new Date(currentCalMonth.getFullYear(), currentCalMonth.getMonth() + 1, 1))} className="w-10 h-10 rounded-xl bg-bg-card border-2 border-border-main flex items-center justify-center text-text-muted hover:text-emerald-500 hover:border-emerald-500/30 transition-all shadow-sm">
                                                <ChevronRight size={20} strokeWidth={3} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-7 gap-1.5 text-center mb-2">
                                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                                            <div key={i} className="text-[10px] font-black text-slate-300 py-2 uppercase tracking-tighter">{d}</div>
                                        ))}
                                        {Array.from({ length: getFirstDayOfMonth(currentCalMonth.getFullYear(), currentCalMonth.getMonth()) }).map((_, i) => <div key={`blank-${i}`} />)}
                                        {Array.from({ length: getDaysInMonth(currentCalMonth.getFullYear(), currentCalMonth.getMonth()) }).map((_, i) => {
                                            const d = i + 1;
                                            const dateObj = new Date(currentCalMonth.getFullYear(), currentCalMonth.getMonth(), d);
                                            const isSelected = tempSelectedDate && isSameDate(tempSelectedDate, dateObj);
                                            const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(dateObj);
                                            const isWeeklyOff = weeklyOffs.includes(dayName);
                                            const isHoliday = isWeeklyOff || holidays.some(h => h && h.date && isSameDate(new Date(h.date), dateObj));
                                            const isToday = isSameDate(new Date(), dateObj);

                                            return (
                                                <button
                                                    key={d}
                                                    type="button"
                                                    onClick={() => {
                                                        if (isHoliday) {
                                                            toast.error("Holiday detected! Please select another date.");
                                                            return;
                                                        }
                                                        setTempSelectedDate(dateObj);
                                                    }}
                                                    className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center text-[13px] font-black transition-all relative group
                                                        ${isHoliday ? 'bg-red-50 text-red-300' :
                                                            isSelected ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-110' :
                                                                'text-text-muted hover:bg-emerald-50 hover:text-emerald-600 hover:scale-105'}
                                                        ${isToday && !isSelected ? 'border-2 border-emerald-500/20' : ''}
                                                    `}
                                                >
                                                    {d}
                                                    {isToday && !isSelected && <div className="absolute top-1.5 right-1.5 w-1 h-1 bg-emerald-500 rounded-full"></div>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-10 py-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="flex items-center gap-6">
                                        {/* Hours */}
                                        <div className="flex flex-col items-center gap-3">
                                            <button type="button" onClick={() => {
                                                let h = parseInt(tempSelectedTime.hours);
                                                h = h >= 12 ? 1 : h + 1;
                                                setTempSelectedTime(prev => ({ ...prev, hours: h.toString().padStart(2, '0') }));
                                            }} className="w-10 h-10 rounded-xl bg-bg-main flex items-center justify-center text-text-muted hover:text-emerald-500 hover:bg-emerald-50 transition-all">
                                                <ChevronDown size={24} className="rotate-180" strokeWidth={3} />
                                            </button>
                                            <div className="w-20 h-24 bg-bg-card border-2 border-border-main rounded-[28px] flex items-center justify-center text-4xl font-black text-text-main shadow-sm leading-none">
                                                {tempSelectedTime.hours}
                                            </div>
                                            <button type="button" onClick={() => {
                                                let h = parseInt(tempSelectedTime.hours);
                                                h = h <= 1 ? 12 : h - 1;
                                                setTempSelectedTime(prev => ({ ...prev, hours: h.toString().padStart(2, '0') }));
                                            }} className="w-10 h-10 rounded-xl bg-bg-main flex items-center justify-center text-text-muted hover:text-emerald-500 hover:bg-emerald-50 transition-all">
                                                <ChevronDown size={24} strokeWidth={3} />
                                            </button>
                                        </div>

                                        <div className="text-4xl font-black text-slate-200 -mt-10">:</div>

                                        {/* Minutes */}
                                        <div className="flex flex-col items-center gap-3">
                                            <button type="button" onClick={() => {
                                                let m = parseInt(tempSelectedTime.minutes);
                                                m = m >= 59 ? 0 : m + 1;
                                                setTempSelectedTime(prev => ({ ...prev, minutes: m.toString().padStart(2, '0') }));
                                            }} className="w-10 h-10 rounded-xl bg-bg-main flex items-center justify-center text-text-muted hover:text-emerald-500 hover:bg-emerald-50 transition-all">
                                                <ChevronDown size={24} className="rotate-180" strokeWidth={3} />
                                            </button>
                                            <div className="w-20 h-24 bg-bg-card border-2 border-border-main rounded-[28px] flex items-center justify-center text-4xl font-black text-text-main shadow-sm leading-none">
                                                {tempSelectedTime.minutes}
                                            </div>
                                            <button type="button" onClick={() => {
                                                let m = parseInt(tempSelectedTime.minutes);
                                                m = m <= 0 ? 59 : m - 1;
                                                setTempSelectedTime(prev => ({ ...prev, minutes: m.toString().padStart(2, '0') }));
                                            }} className="w-10 h-10 rounded-xl bg-bg-main flex items-center justify-center text-text-muted hover:text-emerald-500 hover:bg-emerald-50 transition-all">
                                                <ChevronDown size={24} strokeWidth={3} />
                                            </button>
                                        </div>

                                        {/* AM/PM */}
                                        <div className="flex flex-col gap-3 py-2">
                                            {['AM', 'PM'].map(p => (
                                                <button
                                                    key={p}
                                                    type="button"
                                                    onClick={() => setTempSelectedTime(prev => ({ ...prev, ampm: p }))}
                                                    className={`px-5 py-3 rounded-2xl text-[14px] font-black transition-all border-2 ${tempSelectedTime.ampm === p ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-bg-card border-border-main text-text-muted hover:border-emerald-500 shadow-sm'}`}
                                                >
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ActionModal>
                )}
                {/* Users Selection Modal */}
                {activeModal === 'users' && (
                    <ActionModal
                        title="Assign Tasks To"
                        onClose={() => setActiveModal(null)}
                        onSave={() => setActiveModal(null)}
                    >
                        <div className="flex flex-col gap-4">
                            <div className="p-1 border-b border-slate-50">
                                <div className="flex items-center gap-3 bg-bg-card px-4 py-2.5 border-2 border-border-main focus-within:border-emerald-500/30 rounded-2xl transition-all shadow-sm">
                                    <Search size={18} className="text-slate-300" />
                                    <input type="text" placeholder="Search Users..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="bg-transparent text-[14px] font-bold text-text-main placeholder:text-slate-300 outline-none w-full" autoFocus />
                                </div>
                            </div>
                            <div className="max-h-[50vh] overflow-y-auto px-1 py-1 flex flex-col gap-2 custom-scrollbar">
                                {filteredUsers.length === 0 ? renderEmptyState() : filteredUsers.map(u => {
                                    const uid = u.userId || u.id || u.User_Id;
                                    const firstName = u.firstName || u.first_name || '';
                                    const lastName = u.lastName || u.last_name || '';
                                    const email = u.email || u.workEmail || u.work_email || '';
                                    const isSelected = formData.doerId.some(id => String(id) === String(uid));

                                    return (
                                        <div 
                                            key={uid} 
                                            onClick={() => initialData?.id ? setFormData(prev => ({ ...prev, doerId: [uid] })) : toggleUserSelect(uid, 'doerId')} 
                                            className={`p-3.5 hover:bg-emerald-50/50 rounded-2xl cursor-pointer flex items-center gap-4 transition-all border-2 ${isSelected ? 'bg-emerald-50 border-emerald-100 shadow-sm' : 'border-transparent'}`}
                                        >
                                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center text-sm font-black text-white shrink-0 relative shadow-lg">
                                                {firstName?.charAt(0)}{lastName?.charAt(0)}
                                                {isSelected && (
                                                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-emerald-600 border-2 border-white rounded-full flex items-center justify-center shadow-xl">
                                                        <Check size={12} className="text-white" strokeWidth={4} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[13px] font-black text-text-main truncate">{firstName} {lastName}</div>
                                                <div className="text-[11px] text-text-muted font-bold truncate tracking-tight">{email}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </ActionModal>
                )}

                {/* In Loop Modal */}
                {activeModal === 'inLoop' && (
                    <ActionModal
                        title="Add Team in Loop"
                        onClose={() => setActiveModal(null)}
                        onSave={() => setActiveModal(null)}
                        saveText="Apply Selection"
                    >
                        <div className="flex flex-col gap-6">
                            <div className="flex items-center gap-4 bg-bg-main border-2 border-border-main rounded-2xl px-5 py-4 focus-within:border-emerald-500/30 transition-all shadow-inner-sm">
                                <Search size={20} className="text-slate-300" />
                                <input
                                    type="text"
                                    placeholder="Search team members..."
                                    value={loopSearch}
                                    onChange={e => setLoopSearch(e.target.value)}
                                    className="bg-transparent text-[15px] font-black text-text-main placeholder:text-slate-300 outline-none w-full"
                                    autoFocus
                                />
                                {formData.inLoopIds.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, inLoopIds: [] }))}
                                        className="text-[11px] font-black text-red-500 uppercase tracking-widest hover:text-red-600 transition-colors whitespace-nowrap"
                                    >
                                        Clear All
                                    </button>
                                )}
                            </div>

                            <div className="flex-1 max-h-[400px] overflow-y-auto px-1 custom-scrollbar">
                                {filteredLoopUsers.length === 0 ? renderEmptyState() : (
                                    <div className="grid grid-cols-1 gap-2.5">
                                        {filteredLoopUsers.map(u => {
                                            const uid = u.userId || u.id || u.User_Id;
                                            const firstName = u.firstName || u.first_name || '';
                                            const lastName = u.lastName || u.last_name || '';
                                            const email = u.email || u.workEmail || u.work_email || '';
                                            const isSelected = formData.inLoopIds.some(id => String(id) === String(uid));

                                            return (
                                                <div
                                                    key={uid}
                                                    onClick={() => toggleUserSelect(uid, 'inLoopIds')}
                                                    className={`p-4 rounded-[28px] cursor-pointer flex items-center gap-5 transition-all border-2 group ${isSelected ? 'bg-emerald-50/50 border-emerald-500 shadow-sm shadow-emerald-500/10' : 'bg-bg-card border-slate-50 hover:border-emerald-500/30'}`}
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-500 flex items-center justify-center text-sm font-black text-white shrink-0 relative shadow-lg">
                                                        {firstName?.charAt(0)}{lastName?.charAt(0)}
                                                        {isSelected && (
                                                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center shadow-xl">
                                                                <Check size={14} className="text-white" strokeWidth={4} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[16px] font-black text-text-main truncate tracking-tight">{firstName} {lastName}</div>
                                                        <div className="text-[12px] text-text-muted font-bold truncate tracking-widest uppercase opacity-70">{email}</div>
                                                    </div>
                                                    {!isSelected && (
                                                        <div className="w-6 h-6 rounded-full border-2 border-border-main group-hover:border-emerald-500/20 transition-all shrink-0" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </ActionModal>
                )}

                {/* Department Selection Modal */}
                {activeModal === 'department' && (
                    <ActionModal
                        title="Select Department"
                        onClose={() => setActiveModal(null)}
                        onSave={() => setActiveModal(null)}
                    >
                        <div className="flex flex-col gap-4">
                            <div className="p-1 border-b border-slate-50">
                                <div className="flex items-center gap-3 bg-bg-card px-4 py-2.5 border-2 border-border-main rounded-2xl focus-within:border-emerald-500/30 transition-all shadow-sm">
                                    <Search size={18} className="text-slate-300" />
                                    <input type="text" placeholder="Find department..." value={departmentSearch} onChange={e => setDepartmentSearch(e.target.value)} className="flex-1 bg-transparent px-1 text-[14px] font-bold text-text-main placeholder:text-slate-300 outline-none" autoFocus />
                                </div>
                            </div>
                            <div className="max-h-[50vh] overflow-y-auto p-1 flex flex-col gap-2 custom-scrollbar">
                                {isMasterLoading ? (
                                    <div className="py-6 text-center text-[13px] font-bold text-text-muted">Loading departments...</div>
                                ) : filteredDepartments.length === 0 ? (
                                    <div className="py-6 text-center text-[13px] font-bold text-text-muted">No departments found</div>
                                ) : filteredDepartments.map((dept) => (
                                    <button key={dept.id} onClick={() => { setFormData(prev => ({ ...prev, department: dept.name })); setActiveModal(null); }} className={`text-left px-5 py-4 rounded-2xl text-[14px] font-black transition-all flex items-center gap-5 border-2 ${formData.department === dept.name ? 'text-emerald-700 bg-emerald-50 border-emerald-100 shadow-sm' : 'text-text-muted hover:bg-emerald-50/50 border-transparent'}`}>
                                        <Building2 size={16} className={formData.department === dept.name ? 'text-emerald-500' : 'text-slate-300'} />
                                        {dept.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </ActionModal>
                )}

                {/* Category Selection Modal */}
                {activeModal === 'category' && (
                    <ActionModal
                        title="Select Category"
                        onClose={() => setActiveModal(null)}
                        onSave={() => setActiveModal(null)}
                        showAdd={true}
                        onAdd={() => setIsAddCategoryModalOpen(true)}
                    >
                        <div className="flex flex-col gap-4">
                            <div className="p-1 border-b border-slate-50">
                                <div className="flex items-center gap-3 bg-bg-card px-4 py-2.5 border-2 border-border-main rounded-2xl focus-within:border-emerald-500/30 transition-all shadow-sm">
                                    <Search size={18} className="text-slate-300" />
                                    <input type="text" placeholder="Find category..." value={categorySearch} onChange={e => setCategorySearch(e.target.value)} className="flex-1 bg-transparent px-1 text-[14px] font-bold text-text-main placeholder:text-slate-300 outline-none" autoFocus />
                                </div>
                            </div>
                            <div className="max-h-[50vh] overflow-y-auto p-1 flex flex-col gap-2 custom-scrollbar">
                                {filteredCategories.map(c => (
                                    <button key={c.id} onClick={() => { setFormData(prev => ({ ...prev, category: c.name })); setActiveModal(null); }} className={`text-left px-5 py-4 rounded-2xl text-[14px] font-black transition-all flex items-center gap-5 border-2 ${formData.category === c.name ? 'text-emerald-700 bg-emerald-50 border-emerald-100 shadow-sm' : 'text-text-muted hover:bg-emerald-50/50 border-transparent'}`}>
                                        <div className="w-4 h-4 rounded-full shadow-lg" style={{ backgroundColor: c.color }} />
                                        {c.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </ActionModal>
                )}
                {/* Attachments Modal */}
                {activeModal === 'attachment' && (
                    <ActionModal
                        title="Add Attachments"
                        onClose={() => setActiveModal(null)}
                        onSave={() => setActiveModal(null)}
                        showAdd={true}
                        onAdd={() => fileInputRef.current?.click()}
                    >
                        <div className="flex flex-col gap-4">
                            {attachments.length === 0 ? (
                                <div className="text-center py-10 px-6 border-2 border-dashed border-border-main rounded-3xl bg-bg-main">
                                    <div className="w-16 h-16 rounded-full bg-bg-card flex items-center justify-center mx-auto mb-4 shadow-sm">
                                        <Paperclip size={24} className="text-slate-300" />
                                    </div>
                                    <div className="text-text-muted text-[14px] font-black uppercase tracking-widest leading-relaxed">Click "Add More" to select files <br /> from your computer.</div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {attachments.map((file, i) => (
                                        <div key={i} className="flex items-center justify-between bg-emerald-50/30 border-2 border-emerald-100/30 p-4 rounded-2xl group hover:border-emerald-500/20 transition-all">
                                            <div className="flex items-center gap-4 overflow-hidden">
                                                <div className="w-9 h-9 rounded-xl bg-bg-card border border-emerald-100 flex items-center justify-center shrink-0 shadow-sm">
                                                    <Paperclip size={16} className="text-emerald-500" strokeWidth={3} />
                                                </div>
                                                <span className="text-[12px] font-black text-text-main truncate">{file.name}</span>
                                            </div>
                                            <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all">
                                                <X size={18} strokeWidth={3} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple />
                            <input type="file" ref={imageInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" multiple />
                        </div>
                    </ActionModal>
                )}

                {/* Reminders Modal */}
                {activeModal === 'reminder' && (
                    <ActionModal
                        title="Task Reminders"
                        onClose={() => setActiveModal(null)}
                        onSave={() => setActiveModal(null)}
                        showAdd={true}
                        onAdd={addReminder}
                    >
                        <div className="flex flex-col gap-8">
                            {reminders.map((reminder, idx) => (
                                <div key={reminder.id} className="bg-bg-card border-2 border-border-main rounded-2xl p-5 shadow-sm relative group animate-in slide-in-from-top-4 duration-300">
                                    <div className="flex flex-col gap-7">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-black text-xs shadow-md shadow-emerald-500/20">{idx + 1}</div>
                                                <span className="text-text-main font-black text-[13px] uppercase tracking-widest">Reminder {idx + 1}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 bg-bg-main p-1.5 rounded-2xl border border-border-main">
                                                {['WhatsApp', 'Email', 'Both'].map(m => (
                                                    <button key={m} onClick={() => updateReminder(reminder.id, 'medium', m)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-wide ${reminder.medium === m ? 'bg-bg-card text-emerald-600 shadow-sm' : 'text-text-muted hover:text-text-muted'}`}>{m}</button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <div className="flex items-center gap-4">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={reminder.timeValue}
                                                    onChange={(e) => updateReminder(reminder.id, 'timeValue', e.target.value)}
                                                    className="w-24 bg-bg-main border-2 border-border-main rounded-2xl px-4 py-3 text-text-main text-[15px] font-black outline-none focus:border-emerald-500/30 transition-all text-center"
                                                />
                                                <div className="relative flex-1">
                                                    <select
                                                        value={reminder.timeUnit}
                                                        onChange={(e) => updateReminder(reminder.id, 'timeUnit', e.target.value)}
                                                        className="w-full appearance-none bg-bg-main border-2 border-border-main rounded-2xl pl-5 pr-10 py-3 text-text-muted text-[14px] font-black outline-none focus:border-emerald-500/30 cursor-pointer uppercase tracking-wider"
                                                    >
                                                        <option value="minutes">mins</option>
                                                        <option value="hours">hrs</option>
                                                        <option value="days">days</option>
                                                    </select>
                                                    <div className="absolute right-4 top-0 bottom-0 flex items-center pointer-events-none text-slate-300">
                                                        <ChevronDown size={18} strokeWidth={3} />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6 justify-center bg-bg-main rounded-2xl p-2 border border-border-main">
                                                {['Before', 'After'].map(relation => (
                                                    <label key={relation} className="flex items-center gap-3 cursor-pointer group/opt">
                                                        <div className="relative flex items-center">
                                                            <input
                                                                type="radio"
                                                                className="peer hidden"
                                                                checked={reminder.triggerType === relation.toLowerCase()}
                                                                onChange={() => updateReminder(reminder.id, 'triggerType', relation.toLowerCase())}
                                                            />
                                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${reminder.triggerType === relation.toLowerCase() ? 'bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20' : 'bg-bg-card border-border-main peer-hover:border-emerald-500/30'}`}>
                                                                {reminder.triggerType === relation.toLowerCase() && <div className="w-2.5 h-2.5 bg-bg-card rounded-full"></div>}
                                                            </div>
                                                        </div>
                                                        <span className={`text-[11px] font-black uppercase tracking-widest transition-colors ${reminder.triggerType === relation.toLowerCase() ? 'text-emerald-600' : 'text-text-muted group-hover/opt:text-text-muted'}`}>{relation}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    {reminders.length > 1 && (
                                        <button onClick={() => removeReminder(reminder.id)} className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-bg-card border-2 border-border-main text-slate-300 flex items-center justify-center hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all shadow-sm">
                                            <Trash2 size={18} strokeWidth={2.5} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </ActionModal>
                )}

                {/* Voice Memo Modal */}
                {activeModal === 'voice' && (
                    <ActionModal
                        title="Voice Note"
                        onClose={() => { setIsRecording(false); setVoiceState('idle'); setActiveModal(null); }}
                        onSave={() => setActiveModal(null)}
                        showFooter={voiceState === 'recorded'}
                    >
                        <div className="flex flex-col items-center justify-center py-6">
                            {voiceState === 'idle' && (
                                <>
                                    <div className="w-24 h-24 rounded-[32px] bg-emerald-50 flex items-center justify-center mb-8 shadow-sm">
                                        <Mic size={40} className="text-emerald-500" strokeWidth={2.5} />
                                    </div>
                                    <div className="text-text-muted text-[14px] font-black uppercase tracking-[0.15em] mb-10 text-center leading-relaxed">Click Record to start <br /> recording a voice memo</div>
                                    <button
                                        onClick={() => {
                                            setIsRecording(true);
                                            setVoiceState('recording');
                                            setRecordingTime(0);

                                            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                                                navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                                                    mediaRecorderRef.current = new MediaRecorder(stream);
                                                    mediaRecorderRef.current.ondataavailable = (e) => {
                                                        if (e.data.size > 0) audioChunksRef.current.push(e.data);
                                                    };
                                                    mediaRecorderRef.current.onstop = () => {
                                                        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                                                        setAudioBlob(blob);
                                                        audioChunksRef.current = [];
                                                        stream.getTracks().forEach(track => track.stop());
                                                    };
                                                    mediaRecorderRef.current.start();
                                                }).catch(err => {
                                                    console.error("Microphone access denied:", err);
                                                    setVoiceState('idle');
                                                    setIsRecording(false);
                                                });
                                            }
                                        }}
                                        className="group px-12 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl text-[15px] transition-all flex items-center gap-3 shadow-xl shadow-emerald-500/20 active:scale-95 uppercase tracking-widest"
                                    >
                                        <Mic size={20} strokeWidth={3} className="group-hover:animate-pulse" /> Record
                                    </button>
                                </>
                            )}

                            {voiceState === 'recording' && (
                                <div className="flex flex-col items-center w-full">
                                    <div className="text-emerald-600 font-black text-[32px] font-mono tracking-wider mb-10 bg-emerald-50 px-8 py-3 rounded-3xl shadow-inner-sm">
                                        {formatTime(recordingTime)}
                                    </div>
                                    <div className="flex items-end justify-center gap-1.5 mb-12 h-16 w-full px-10">
                                        {[...Array(30)].map((_, i) => (
                                            <div
                                                key={i}
                                                className="w-2 bg-emerald-400 rounded-full animate-wave"
                                                style={{
                                                    height: `${Math.max(20, Math.random() * 100)}%`,
                                                    animationDelay: `${i * 0.05}s`
                                                }}
                                            ></div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => {
                                            setIsRecording(false);
                                            setVoiceState('recorded');
                                            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                                                mediaRecorderRef.current.stop();
                                            }
                                        }}
                                        className="px-10 py-4 bg-red-500 hover:bg-red-600 text-white font-black rounded-2xl text-[14px] flex items-center gap-3 shadow-xl shadow-red-500/20 transition-all uppercase tracking-widest"
                                    >
                                        <div className="w-3.5 h-3.5 bg-bg-card rounded-sm shadow-sm"></div> Stop Recording
                                    </button>
                                </div>
                            )}

                            {voiceState === 'recorded' && (
                                <div className="flex flex-col w-full px-2">
                                    <div className="bg-bg-main border-2 border-border-main rounded-[32px] p-8 mb-8 shadow-inner-sm border-dashed">
                                        <div className="flex items-center justify-center mb-6">
                                            <div className="px-6 py-2 bg-emerald-100 rounded-full">
                                                <span className="text-emerald-700 font-black text-[12px] uppercase tracking-[0.2em]">Recording Ready</span>
                                            </div>
                                        </div>
                                        {audioBlob ? (
                                            <div className="flex flex-col gap-4">
                                                <audio controls src={URL.createObjectURL(audioBlob)} className="w-full h-12 outline-none" />
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-4">
                                                <div className="text-text-muted text-[13px] font-black text-center mb-2 uppercase tracking-wide">00:00 / {formatTime(recordingTime)}</div>
                                                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                                                    <div className="w-1/3 h-full bg-emerald-500 rounded-full"></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-center gap-6">
                                        <button
                                            onClick={() => {
                                                setVoiceState('idle');
                                                setRecordingTime(0);
                                                setAudioBlob(null);
                                                audioChunksRef.current = [];
                                            }}
                                            className="px-8 py-3 rounded-2xl border-2 border-red-100 hover:bg-red-50 text-red-500 font-black text-[13px] flex items-center gap-2.5 transition-all uppercase tracking-widest"
                                        >
                                            <X size={18} strokeWidth={3} /> Clear Note
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ActionModal>
                )}

                {/* Links Modal */}
                {activeModal === 'link' && (
                    <ActionModal
                        title="Reference Links"
                        onClose={() => setActiveModal(null)}
                        onSave={() => setActiveModal(null)}
                    >
                        <div className="flex flex-col gap-6">
                            <div className="flex items-center gap-4 bg-bg-main border-2 border-border-main rounded-2xl p-2.5 focus-within:border-emerald-500/30 transition-all shadow-inner-sm">
                                <div className="w-10 h-10 rounded-xl bg-bg-card border border-border-main flex items-center justify-center shrink-0">
                                    <Globe size={18} className="text-emerald-500" strokeWidth={2.5} />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Paste URL here..."
                                    value={newLinkText}
                                    onChange={e => setNewLinkText(e.target.value)}
                                    className="bg-transparent text-[14px] font-black text-text-main placeholder:text-slate-300 outline-none w-full px-2"
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && newLinkText.trim()) {
                                            setLinks([...links, newLinkText.trim()]);
                                            setNewLinkText('');
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        if (newLinkText.trim()) {
                                            setLinks([...links, newLinkText.trim()]);
                                            setNewLinkText('');
                                        }
                                    }}
                                    className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-[14px] text-[13px] transition-all shadow-md shadow-emerald-500/20 active:scale-95 uppercase tracking-wide"
                                >
                                    Add
                                </button>
                            </div>
                            <div className="flex flex-col gap-3">
                                {links.map((link, i) => (
                                    <div key={i} className="flex items-center justify-between bg-bg-card border-2 border-border-main p-4 rounded-2xl group hover:border-emerald-500/20 transition-all">
                                        <div className="flex items-center gap-4 overflow-hidden">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                                                <Globe size={18} className="text-emerald-500" strokeWidth={2.5} />
                                            </div>
                                            <span className="text-[14px] font-black text-text-main truncate tracking-tight">{link}</span>
                                        </div>
                                        <button onClick={() => setLinks(prev => prev.filter((_, idx) => idx !== i))} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all">
                                            <X size={18} strokeWidth={3} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </ActionModal>
                )}

                {/* Add Category Modal */}
                {isAddCategoryModalOpen && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setIsAddCategoryModalOpen(false)} />
                        <div className="relative w-full max-w-[460px] bg-bg-card rounded-[40px] shadow-[0_30px_100px_rgba(0,0,0,0.25)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="flex items-center justify-between p-7 border-b border-slate-50 bg-emerald-50/20">
                                <h3 className="text-[17px] font-black text-text-main uppercase tracking-widest">New Category</h3>
                                <button onClick={() => setIsAddCategoryModalOpen(false)} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all">
                                    <X size={24} strokeWidth={2.5} />
                                </button>
                            </div>
                            <div className="p-10 flex flex-col gap-10">
                                <div className="relative">
                                    <label className="absolute -top-2.5 left-5 px-3 bg-bg-card text-[10px] font-black text-emerald-500 z-10 uppercase tracking-[0.2em] shadow-sm-bottom">Identifier</label>
                                    <input
                                        type="text"
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        placeholder="Ex: Marketing Strategy"
                                        className="w-full bg-bg-main border-2 border-border-main rounded-2xl px-6 py-4.5 text-[15px] font-black text-text-main outline-none focus:border-emerald-500/30 transition-all placeholder:text-slate-300 uppercase tracking-wide"
                                        autoFocus
                                        maxLength={50}
                                    />
                                    <div className="absolute -bottom-6 right-2 text-[10px] font-black text-slate-300 uppercase tracking-widest">{newCategoryName.length} / 50</div>
                                </div>

                                <div className="space-y-5">
                                    <div className="text-[11px] font-black text-text-muted uppercase tracking-[0.25em] text-center">Pick Category Tone</div>
                                    <div className="grid grid-cols-10 gap-2.5 justify-center">
                                        {categoryColors.map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setSelectedColor(color)}
                                                className={`w-7 h-7 rounded-xl transition-all flex items-center justify-center hover:scale-110 active:scale-95 ${selectedColor === color ? 'bg-bg-card shadow-[0_4px_15px_rgba(0,0,0,0.1)] ring-4 ring-offset-2' : 'hover:shadow-md'}`}
                                                style={{
                                                    backgroundColor: color,
                                                    '--tw-ring-color': `${color}40`
                                                }}
                                            >
                                                {selectedColor === color && (
                                                    <div className="w-1.5 h-1.5 bg-bg-card rounded-full shadow-sm" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-center mt-2">
                                    <button
                                        onClick={handleSaveCategory}
                                        disabled={!newCategoryName.trim()}
                                        className="px-12 py-4 bg-gradient-to-br from-[#00d094] to-[#00b882] disabled:opacity-30 text-white font-black rounded-2xl text-[14px] transition-all shadow-xl shadow-emerald-500/20 active:scale-95 uppercase tracking-widest"
                                    >
                                        Create Category
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Extracted ActionModal outside TaskCreationForm functional component to prevent input focus loss caused by inline component re-renders
const ActionModal = ({ title, children, showFooter = true, onClose, onSave, saveText = "Apply Changes", showAdd = false, onAdd }) => (
    <div className="absolute inset-0 z-[150] flex items-center justify-center bg-slate-900/10 backdrop-blur-[2px] rounded-2xl animate-in fade-in duration-300 p-3">
        <div className="w-full max-w-[480px] bg-bg-card border border-border-main rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between p-4 border-b border-slate-50 bg-emerald-50/20">
                <h3 className="text-sm font-bold text-text-main uppercase tracking-widest">{title}</h3>
                <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-emerald-500 hover:bg-emerald-50 transition-all bg-transparent border-none">
                    <X size={20} strokeWidth={2.5} />
                </button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto custom-scrollbar bg-bg-card">
                {children}
            </div>
            {showFooter && (
                <div className="p-4 border-t border-slate-50 flex items-center justify-end gap-3 bg-bg-main/30">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl text-[11px] font-bold text-text-muted hover:text-text-muted transition-all uppercase tracking-widest">
                        Cancel
                    </button>
                    {showAdd && (
                        <button onClick={onAdd} className="px-4 py-2 rounded-xl border-2 border-emerald-500/30 bg-bg-card hover:bg-emerald-50 text-emerald-600 font-bold text-[11px] flex items-center gap-2 transition-all uppercase tracking-widest shadow-sm">
                            <Plus size={16} strokeWidth={3} /> Add More
                        </button>
                    )}
                    <button onClick={onSave} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#f97316] to-[#fb923c] hover:shadow-orange-500/25 text-white font-bold text-[11px] flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/15 active:scale-95 uppercase tracking-widest">
                        <Save size={16} strokeWidth={3} /> {saveText}
                    </button>
                </div>
            )}
        </div>
    </div>
);

export default TaskCreationForm;





