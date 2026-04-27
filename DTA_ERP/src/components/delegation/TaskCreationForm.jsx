import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar as CalendarIcon, Users, AlignLeft, Flag, CheckSquare, Paperclip, Mic, Upload, Plus, ChevronDown, Search, Pencil, ChevronLeft, ChevronRight, Save, Trash2, Clock, Globe, Image as ImageIcon, Check, AlertCircle, Building2, PlayCircle } from 'lucide-react';
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

// Helper to format date as YYYY-MM-DD in local time
const formatLocalDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Helper to display date string (YYYY-MM-DD) in short format (e.g., 30 APR)
const displayLocalDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
};

const normalizeIdArray = (value) => {
 if (value === undefined || value === null || value === '' || value === 'undefined' || value === 'null') return [];
 if (Array.isArray(value)) return value.map(v => parseInt(v)).filter(v => !isNaN(v));
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

const ActionModal = ({ title, children, onClose, onSave, saveText = "Save Changes", showAdd = false, onAdd, showFooter = true }) => (
 <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
 <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
 <div className="relative w-full max-w-[420px] bg-bg-card rounded-[2rem] shadow-2xl border border-border-main animate-in zoom-in-95 duration-300 flex flex-col overflow-hidden premium-shadow">
 <div className="px-7 py-6 border-b border-border-main flex items-center justify-between bg-bg-main backdrop-blur-sm">
 <h3 className="text-[11px] font-black text-text-main uppercase tracking-[0.2em]">{title}</h3>
 <div className="flex items-center gap-2.5">
 {showAdd && (
 <button onClick={onAdd} className="w-9 h-9 rounded-xl bg-[#137fec] hover:bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 transition-all active:scale-90">
 <Plus size={18} strokeWidth={3} />
 </button>
 )}
 <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center text-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all">
 <X size={18} strokeWidth={2.5} />
 </button>
 </div>
 </div>
 <div className="p-7 overflow-y-auto custom-scrollbar bg-bg-card min-h-0 flex-1">
 {children}
 </div>
 {showFooter && (
 <div className="p-5 border-t border-border-main bg-bg-main flex justify-end">
 <button onClick={onSave} className="px-8 py-2.5 bg-[#137fec] hover:bg-blue-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 active:scale-95">
 {saveText}
 </button>
 </div>
 )}
 </div>
 </div>
);

const TaskCreationForm = ({ isOpen, onClose, onSuccess, groupId, initialData, parentId, isMyTask }) => {
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
  const [typedHour, setTypedHour] = useState('12');
  const [typedMin, setTypedMin] = useState('00');
  
 

 // Checklist
 const [checklistExpanded, setChecklistExpanded] = useState(false);
 const [checklistItems, setChecklistItems] = useState([]);
 const [newChecklistText, setNewChecklistText] = useState('');

 // Reminders
 const [reminders, setReminders] = useState([{
 id: 1,
 medium: 'WhatsApp', // WhatsApp, Email, Both
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
 const [repeatStartDate, setRepeatStartDate] = useState(formatLocalDate(new Date()));
 const [repeatIntervalDays, setRepeatIntervalDays] = useState('1');
 const [occurEveryMode, setOccurEveryMode] = useState('Week'); // 'Week' | 'Month'
 const [customOccurValue, setCustomOccurValue] = useState('1');
 const [customOccurDays, setCustomOccurDays] = useState([]);
 const [customOccurDates, setCustomOccurDates] = useState([]);
 const [isLastDayOfMonth, setIsLastDayOfMonth] = useState(false);

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

 

 useEffect(() => {
 if (isOpen) {
 fetchUsers();
 fetchCategories();
 fetchNotificationSettings();

 if (initialData) {
 setFormData(normalizeTaskForForm(initialData));

 if (initialData.checklistItems) {
 const parsed = typeof initialData.checklistItems === 'string' ? JSON.parse(initialData.checklistItems) : initialData.checklistItems;
 setChecklistItems(parsed.map((item, idx) => ({ id: Date.now() + idx, text: item.itemName || item.text || '', completed: item.completed || false })));
 setChecklistExpanded(parsed.length > 0);
 }

 if (initialData.reminders) {
 const parsedReminders = typeof initialData.reminders === 'string' ? JSON.parse(initialData.reminders) : initialData.reminders;
 setReminders(Array.isArray(parsedReminders) ? parsedReminders.map((r, idx) => ({ id: r.id || Date.now() + idx, ...r, timeValue: r.timeValue?.toString() || '10' })) : []);
 }

   if (initialData.referenceDocs && typeof initialData.referenceDocs === 'string') {
        const repeat = typeof initialData.repeatSettings === 'string' 
          ? JSON.parse(initialData.repeatSettings) 
          : (initialData.repeatSettings || {});
        
        setIsRepeat(repeat.isRepeat || initialData.isRepeat || false);
        if (repeat.isRepeat || initialData.isRepeat) {
          setRepeatMode(repeat.repeatFrequency || 'Daily');
          setRepeatStartDate(repeat.repeatStartDate || formatLocalDate(new Date()));
          setRepeatEndDate(repeat.repeatEndDate || '');
          setRepeatIntervalDays(repeat.repeatIntervalDays?.toString() || '1');
          setWeeklyDays(repeat.weeklyDays || []);
          setSelectedDates(repeat.selectedDates || []);
          setOccurEveryMode(repeat.occurEveryMode || 'Week');
          setCustomOccurValue(repeat.customOccurValue?.toString() || '1');
          setCustomOccurDays(repeat.customOccurDays || []);
          setCustomOccurDates(repeat.customOccurDates || []);
          setIsLastDayOfMonth(repeat.isLastDayOfMonth || false);
        }
 setLinks(initialData.referenceDocs.split(',').filter(Boolean));
 } else if (initialData.reference_docs && typeof initialData.reference_docs === 'string') {
 setLinks(initialData.reference_docs.split(',').filter(Boolean));
 } else if (Array.isArray(initialData.referenceDocs)) {
 setLinks(initialData.referenceDocs);
 } else if (Array.isArray(initialData.reference_docs)) {
 setLinks(initialData.reference_docs);
 }
       } else {
        setFormData({ taskTitle: '', description: '', doerId: [], department: '', category: '', priority: 'Low', dueDate: null, evidenceRequired: false, inLoopIds: [], });
        setChecklistItems([]);
        setChecklistExpanded(false);
        setRepeatMode('Daily');
        setRepeatEndDate(''); 
        setRepeatStartDate(formatLocalDate(new Date()));
        setRepeatIntervalDays('1'); 
        setOccurEveryMode('Week'); 
        setCustomOccurValue('1');
        setWeeklyDays([]); 
        setSelectedDates([]); 
        setCustomOccurDays([]); 
        setCustomOccurDates([]);
      }
  setError(null); setActiveDropdown(null); setActiveModal(null); setLinks([]); setNewLinkText('');
  fetchHolidays();
  setVoiceState('idle'); setRecordingTime(0); setAudioBlob(null); audioChunksRef.current = [];
 setDepartmentSearch('');
 if (isMyTask && !initialData) {
 const storedUser = JSON.parse(localStorage.getItem('user'));
 const userId = storedUser?.user?.id || storedUser?.id || storedUser?.User_Id;
 if (userId) {
 setFormData(prev => ({ ...prev, doerId: [userId] }));
 }
 }
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

 const fetchCategories = async () => {
 try {
 
 const data = await delegationService.getCategories();
 setCategories(Array.isArray(data) ? data : (data.data || []));
 } catch (err) { console.error('Failed to fetch categories:', err); }
 };

 const handleSaveCategory = async () => {
 if (!newCategoryName.trim()) return;
 try {
 const newCat = await delegationService.createCategory({ name: newCategoryName.trim(), color: selectedColor });
 setCategories([newCat, ...categories]);
 setFormData(prev => ({ ...prev, category: newCat.name }));
 setIsAddCategoryModalOpen(false); setNewCategoryName(''); setActiveDropdown(null);
 toast.success('Category added successfully');
 } catch (err) { setError('Failed to create category'); }
 };

 const handleDeleteCategory = async (categoryId) => {
 try {
 await delegationService.deleteCategory(categoryId);
 setCategories(prev => prev.filter(c => c.id !== categoryId));
 toast.success('Category deleted successfully');
 } catch (err) {
 toast.error('Failed to delete category');
 }
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
 let initialDate;
 if (target === 'dueDate') {
 initialDate = formData.dueDate;
 } else {
 const dateStr = target === 'repeatStartDate' ? repeatStartDate : repeatEndDate;
 if (dateStr && typeof dateStr === 'string' && dateStr.includes('-')) {
 const [y, m, d] = dateStr.split('-').map(Number);
 initialDate = new Date(y, m - 1, d);
 } else {
 initialDate = dateStr || new Date();
 }
 }

 if (initialDate && initialDate instanceof Date && !isNaN(initialDate)) {
 setTempSelectedDate(initialDate); setCurrentCalMonth(initialDate);
 let h = initialDate.getHours(); const m = initialDate.getMinutes().toString().padStart(2, '0');
 const ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
 const hStr = h.toString().padStart(2, '0');
 setTempSelectedTime({ hours: hStr, minutes: m, ampm });
 setTypedHour(hStr); setTypedMin(m);
 } else {
 setTempSelectedDate(new Date());
 setCurrentCalMonth(new Date());
 setTempSelectedTime({ hours: '12', minutes: '00', ampm: 'PM' });
 setTypedHour('12');
 setTypedMin('00');
 }
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

 const renderEmptyState = (message = "No user found") => (
 <div className="flex flex-col items-center justify-center py-10 px-6 text-center select-none animate-in fade-in duration-500">
 <div className="relative mb-8">
 <div className="w-[80px] h-[100px] bg-bg-main rounded-2xl shadow-inner absolute -left-6 -rotate-6 border border-border-main"></div>
 <div className="w-[80px] h-[100px] bg-bg-card rounded-2xl shadow-xl border border-border-main p-3.5 flex flex-col gap-2.5 z-10 relative">
 <div className="w-full h-2 bg-border-main rounded-full"></div>
 <div className="w-3/4 h-2 bg-border-main rounded-full"></div>
 <div className="w-1/2 h-2 bg-border-main rounded-full"></div>
 <div className="w-full h-3 bg-bg-main rounded-full mt-auto"></div>
 </div>
 <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-gradient-to-br from-[#137fec] to-blue-600 rounded-full flex items-center justify-center z-20 shadow-xl shadow-blue-500/30 border-4 border-bg-card">
 <Search size={20} className="text-white" strokeWidth={3} />
 </div>
 </div>
 <div className="text-text-muted font-black text-[13px] uppercase tracking-widest">{message}</div>
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
 formDataToSend.append('department', formData.department || '');
 formDataToSend.append('priority', formData.priority);
 formDataToSend.append('dueDate', formData.dueDate ? new Date(formData.dueDate).toISOString() : '');
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
 customOccurDates,
 isLastDayOfMonth
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
 await taskService.updateTask(initialData.id, formDataToSend); 
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
 const filteredDepartments = (departments || []).filter(d => (d?.name || '').toLowerCase().includes((departmentSearch || '').toLowerCase()));
 const isSameDate = (d1, d2) => d1 && d2 && d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();

 return (
 <div className="fixed inset-0 z-[70] flex p-0 sm:p-4 lg:p-8 pt-0 sm:pt-[5vh] justify-center items-start animate-in fade-in duration-300 overflow-hidden">
 <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
 <div className="relative w-full max-w-[720px] h-full sm:h-auto max-h-screen sm:max-h-[94vh] bg-bg-card sm:rounded-[2.5rem] premium-shadow border border-border-main animate-in zoom-in-95 duration-500 flex flex-col overflow-visible">
 {/* Main Header */}
 <div className="flex items-center justify-between px-7 py-5 border-b border-border-main bg-bg-card/90 backdrop-blur-xl relative sm:rounded-t-[2.5rem] z-10">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#137fec] to-[#0ea5e9] flex items-center justify-center shadow-xl shadow-blue-500/30 ring-4 ring-blue-50">
 <Plus size={22} className="text-white" strokeWidth={3} />
 </div>
 <div>
 <h2 className="text-[15px] font-black text-text-main tracking-tight leading-none mb-1.5">{initialData?.id ? 'Update Task' : (isMyTask ? 'Add New Task' : 'Assign New Task')}</h2>
 <div className="flex items-center gap-2">
 <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${isMyTask ? 'bg-indigo-50 text-indigo-500' : 'bg-blue-50 text-[#137fec]'}`}>
 {isMyTask ? 'Personal' : 'Delegated'}
 </div>
 <span className="text-[9px] font-bold text-text-muted uppercase tracking-tighter">Priority: {formData.priority}</span>
 </div>
 </div>
 </div>
 <button onClick={onClose} className="w-10 h-10 rounded-2xl flex items-center justify-center text-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all border border-transparent hover:border-red-100 dark:hover:border-red-900/30">
 <X size={20} strokeWidth={2.5} />
 </button>
 </div>

 {error && (
 <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 text-red-500 rounded-xl text-sm flex items-center gap-3 animate-in slide-in-from-top-2 duration-200">
 <AlertCircle size={14} /> {error}
 </div>
 )}

 <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0 px-7 py-4 gap-6">
 <div className="flex flex-col gap-1.5">
 <label className="text-[9px] font-black text-text-muted uppercase tracking-widest px-1">Task Title</label>
 <div className="bg-bg-main border border-border-main rounded-2xl p-4 transition-all focus-within:border-[#137fec]/30 focus-within:bg-bg-card shadow-sm">
 <input type="text" name="taskTitle" value={formData.taskTitle} onChange={handleChange} placeholder="What needs to be done?..." className="w-full bg-transparent text-sm font-bold text-text-main placeholder:text-text-muted dark:placeholder:text-text-muted outline-none" autoFocus />
 </div>
 </div>

 <div className="flex flex-col gap-1.5">
 <label className="text-[9px] font-black text-text-muted uppercase tracking-widest px-1">Details & Instructions</label>
 <div className="bg-bg-main border border-border-main rounded-2xl p-4 transition-all focus-within:border-[#137fec]/30 focus-within:bg-bg-card shadow-sm">
 <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Add more context, goals, or instructions here..." className="w-full min-h-[80px] bg-transparent text-[12px] font-medium text-text-main placeholder:text-text-muted dark:placeholder:text-text-muted outline-none resize-none leading-relaxed" />
 </div>
 </div>

 <div className="bg-bg-main border border-border-main rounded-[2rem] overflow-hidden transition-all">
 <div className="p-4 px-6 text-[#137fec] font-black text-[10px] cursor-pointer hover:bg-[#137fec]/10 dark:hover:bg-blue-900/10 transition-all flex items-center justify-between uppercase tracking-widest group" onClick={() => { setChecklistExpanded(!checklistExpanded); if (!checklistExpanded) setTimeout(() => document.getElementById('checklist-input')?.focus(), 100); }}>
 <span className="flex items-center gap-3">
 <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-[#137fec] group-hover:scale-110 transition-transform">
 <Plus size={14} strokeWidth={3} />
 </div>
 Sub-tasks Checklist
 </span>
 <div className="flex items-center gap-3">
 {checklistItems.length > 0 && <span className="bg-[#137fec] text-white text-[9px] px-2 py-0.5 rounded-full">{checklistItems.length}</span>}
 <ChevronDown size={14} className={`text-text-muted transition-transform duration-300 ${checklistExpanded ? 'rotate-180' : ''}`} />
 </div>
 </div>
 {checklistExpanded && (
 <div className="px-6 pb-6 animate-in slide-in-from-top-4 duration-500">
 <div className="space-y-2 mb-4">
 {checklistItems.map(item => (
 <div key={item.id} className="flex items-center gap-3 group bg-bg-card p-2 rounded-xl border border-border-main shadow-sm">
 <button onClick={() => setChecklistItems(prev => prev.map(i => i.id === item.id ? { ...i, completed: !i.completed } : i))} className={`shrink-0 w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${item.completed ? 'bg-[#137fec] border-[#137fec] text-white' : 'border-border-main bg-bg-card hover:border-[#137fec]'}`}>
 {item.completed && <Check size={12} strokeWidth={4} />}
 </button>
 <span className={`text-[12px] font-bold flex-1 ${item.completed ? 'text-text-muted line-through font-medium' : 'text-text-muted'}`}>{item.text}</span>
 <button onClick={() => setChecklistItems(prev => prev.filter(i => i.id !== item.id))} className="text-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={14} /></button>
 </div>
 ))}
 </div>
 <div className="bg-bg-card rounded-2xl border-2 border-dashed border-border-main p-2.5 flex items-center gap-3 transition-all focus-within:border-[#137fec]/40 focus-within:bg-blue-50/20">
 <div className="w-6 h-6 rounded-lg bg-bg-main flex items-center justify-center text-text-muted"><Plus size={14} /></div>
 <input id="checklist-input" type="text" placeholder="Add a sub-task and press Enter..." value={newChecklistText} onChange={e => setNewChecklistText(e.target.value)} onKeyDown={handleAddChecklistItem} className="bg-transparent text-[11px] font-black text-text-main placeholder:text-text-muted dark:placeholder:text-text-muted outline-none w-full" />
 <button onClick={() => handleAddChecklistItem({ key: 'Enter' })} className="bg-[#137fec] hover:bg-blue-600 text-white px-3 py-1.5 rounded-xl shadow-lg shadow-blue-500/20 text-[9px] font-black uppercase tracking-widest transition-all active:scale-95">Add</button>
 </div>
 </div>
 )}
 </div>

 <div className="flex flex-wrap items-center gap-3 px-1 py-2">
 <button onClick={() => toggleModal('users')} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border-2 text-[10px] font-black transition-all shadow-sm uppercase tracking-widest ${formData.doerId.length > 0 ? 'border-[#137fec] bg-blue-50 text-[#137fec] shadow-blue-500/10' : 'border-border-main bg-bg-main text-text-muted hover:border-[#137fec]/30 hover:bg-bg-card'}`}>
 <Users size={16} strokeWidth={2.5} /> {isLoadingUsers ? 'Loading...' : formData.doerId.length > 0 ? `${formData.doerId.length} Selected` : 'Assignee *'}
 </button>
 <button onClick={() => toggleModal('department')} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border-2 text-[10px] font-black transition-all shadow-sm uppercase tracking-widest ${formData.department ? 'border-[#137fec] bg-blue-50 text-[#137fec] shadow-blue-500/10' : 'border-border-main bg-bg-main text-text-muted hover:border-[#137fec]/30 hover:bg-bg-card'}`}>
 <Building2 size={16} strokeWidth={2.5} /> {formData.department || 'Department'}
 </button>
 <button onClick={() => toggleModal('date')} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border-2 text-[10px] font-black transition-all shadow-sm uppercase tracking-widest ${formData.dueDate ? 'border-[#137fec] bg-blue-50 text-[#137fec] shadow-blue-500/10' : 'border-border-main bg-bg-main text-text-muted hover:border-[#137fec]/30 hover:bg-bg-card'}`}>
 <CalendarIcon size={16} strokeWidth={2.5} /> {formData.dueDate ? new Date(formData.dueDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Deadline *'}
 </button>
 <div className="relative">
 <button onClick={(e) => { e.stopPropagation(); toggleDropdown('priority'); }} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border-2 text-[10px] font-black transition-all shadow-sm uppercase tracking-widest ${formData.priority === 'High' ? 'border-red-500 bg-red-50 text-red-600 shadow-red-500/10' : formData.priority === 'Medium' ? 'border-orange-500 bg-orange-50 text-orange-600 shadow-orange-500/10' : 'border-green-500 bg-green-50 text-green-600 shadow-green-500/10'}`}>
 <Flag size={16} strokeWidth={2.5} /> {formData.priority}
 </button>
 {activeDropdown === 'priority' && (
 <div className="absolute top-[calc(100%+12px)] left-0 w-44 bg-bg-card border border-border-main rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[100] flex flex-col p-2 animate-in fade-in slide-in-from-top-4 duration-300">
 {['High', 'Medium', 'Low'].map(p => (
 <button key={p} onClick={() => { setFormData(prev => ({ ...prev, priority: p })); setActiveDropdown(null); }} className={`text-left px-5 py-3 rounded-xl text-[11px] font-black uppercase transition-all flex items-center justify-between ${formData.priority === p ? 'bg-bg-main text-[#137fec] shadow-inner' : 'text-text-muted hover:bg-bg-main'}`}>
 {p} {formData.priority === p && <Check size={14} strokeWidth={4} />}
 </button>
 ))}
 </div>
 )}
 </div>
 <button onClick={() => toggleModal('category')} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border-2 text-[10px] font-black transition-all shadow-sm uppercase tracking-widest ${formData.category ? 'border-[#137fec] bg-blue-50 text-[#137fec] shadow-blue-500/10' : 'border-border-main bg-bg-main text-text-muted hover:border-[#137fec]/30 hover:bg-bg-card'}`}>
 <CheckSquare size={16} strokeWidth={2.5} /> {formData.category || 'Category *'}
 </button>
 <button onClick={() => openModal('inLoop')} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border-2 text-[10px] font-black transition-all shadow-sm uppercase tracking-widest ${formData.inLoopIds.length > 0 ? 'border-[#137fec] bg-blue-50 text-[#137fec] shadow-blue-500/10' : 'border-border-main bg-bg-main text-text-muted hover:border-[#137fec]/30 hover:bg-bg-card'}`}>
 <Users size={16} strokeWidth={2.5} /> {formData.inLoopIds.length > 0 ? `${formData.inLoopIds.length} In Loop` : 'In Loop'}
 </button>
 <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 border-border-main bg-bg-main text-text-muted hover:border-[#137fec]/30 transition-all shadow-sm">
 <label className="flex items-center gap-2.5 cursor-pointer group">
 <div className="relative flex items-center">
 <input type="checkbox" name="evidenceRequired" checked={formData.evidenceRequired} onChange={handleChange} className="peer h-4 w-4 opacity-0 absolute z-10 cursor-pointer" />
 <div className={`h-4 w-4 rounded-md border-2 transition-all flex items-center justify-center ${formData.evidenceRequired ? 'bg-[#137fec] border-[#137fec]' : 'border-slate-300'}`}>
 {formData.evidenceRequired && <Check size={10} className="text-white" strokeWidth={4} />}
 </div>
 </div>
 <span className={`text-[9px] font-black uppercase tracking-widest transition-colors ${formData.evidenceRequired ? 'text-[#137fec]' : 'text-text-muted'}`}>Evidence Required</span>
 </label>
 </div>
 </div>

 <div className="flex flex-col gap-4 p-6 bg-bg-main rounded-[2.5rem] border border-border-main shadow-sm animate-in fade-in duration-500">
 <div className="flex flex-wrap items-center gap-4">
 <button onClick={() => setIsRepeat(!isRepeat)} className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl border-2 transition-all font-black text-[10px] uppercase tracking-widest ${isRepeat ? 'bg-emerald-50 border-emerald-100 text-emerald-600 shadow-sm' : 'bg-bg-card border-border-main text-text-muted'}`}>
 <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${isRepeat ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>
 {isRepeat && <Check size={10} strokeWidth={4} />}
 </div>
 Repeat
 </button>

 {isRepeat && (
 <>
 <div className="relative">
 <button onClick={(e) => { e.stopPropagation(); toggleDropdown('repeatMode'); }} className="flex items-center gap-3 px-5 py-2.5 bg-bg-card border-2 border-border-main rounded-2xl text-[11px] font-black text-[#137fec] uppercase tracking-widest shadow-sm hover:border-[#137fec]/30 transition-all">
 {repeatMode} <ChevronDown size={14} className={activeDropdown === 'repeatMode' ? 'rotate-180 transition-transform' : 'transition-transform'} />
 </button>
 {activeDropdown === 'repeatMode' && (
 <div className="absolute top-[calc(100%+12px)] left-0 w-48 bg-bg-card border border-border-main rounded-2xl shadow-xl z-[100] p-1.5 animate-in slide-in-from-top-2 duration-300">
 {['Daily', 'Weekly', 'Monthly', 'Periodically', 'Custom'].map(mode => (
 <button key={mode} onClick={() => { setRepeatMode(mode); setActiveDropdown(null); }} className={`w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${repeatMode === mode ? 'bg-blue-50 text-[#137fec] shadow-inner' : 'text-text-muted hover:bg-bg-main'}`}>{mode}</button>
 ))}
 </div>
 )}
 </div>

 <button onClick={() => toggleModal('date', 'repeatStartDate')} className="flex items-center gap-3 px-5 py-2.5 bg-bg-card border-2 border-border-main rounded-2xl text-[11px] font-black text-text-muted uppercase tracking-widest shadow-sm hover:border-[#137fec]/30 transition-all">
 <CalendarIcon size={14} className="text-text-muted" /> {repeatStartDate ? displayLocalDate(repeatStartDate) : 'Start Date'}
 </button>
 <button onClick={() => toggleModal('date', 'repeatEndDate')} className="flex items-center gap-3 px-5 py-2.5 bg-bg-card border-2 border-border-main rounded-2xl text-[11px] font-black text-text-muted uppercase tracking-widest shadow-sm hover:border-[#137fec]/30 transition-all">
 <CalendarIcon size={14} className="text-text-muted" /> {repeatEndDate ? displayLocalDate(repeatEndDate) : 'End Date'}
 </button>
 </>
 )}
 </div>

 {isRepeat && (
 <div className="pt-5 border-t border-border-main animate-in fade-in slide-in-from-top-2 duration-500">
 {repeatMode === 'Weekly' && (
 <div className="flex flex-wrap gap-2">
 {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => {
 const isSelected = weeklyDays.includes(day);
 return (
 <button key={day} onClick={() => setWeeklyDays(prev => isSelected ? prev.filter(d => d !== day) : [...prev, day])} className={`px-5 py-2.5 rounded-2xl border-2 font-black text-[10px] tracking-widest transition-all ${isSelected ? 'bg-[#137fec] border-[#137fec] text-white shadow-md scale-105' : 'bg-bg-card border-border-main text-text-muted hover:border-[#137fec]/30 hover:text-[#137fec]'}`}>
 {day}
 </button>
 );
 })}
 </div>
 )}

 {repeatMode === 'Monthly' && (
 <div className="flex flex-col gap-5">
 <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
 {Array.from({ length: 31 }, (_, i) => {
 const date = (i + 1).toString().padStart(2, '0');
 const isSelected = selectedDates.includes(date);
 return (
 <button key={date} onClick={() => setSelectedDates(prev => isSelected ? prev.filter(d => d !== date) : [...prev, date])} className={`h-10 rounded-2xl border-2 font-black text-[11px] transition-all ${isSelected ? 'bg-[#137fec] border-[#137fec] text-white shadow-md' : 'bg-bg-card border-border-main text-text-muted hover:border-[#137fec]/30 hover:text-[#137fec]'}`}>
 {i + 1}
 </button>
 );
 })}
 </div>
 <button onClick={() => setIsLastDayOfMonth(!isLastDayOfMonth)} className={`px-8 py-3 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all self-start ${isLastDayOfMonth ? 'bg-[#137fec] border-[#137fec] text-white shadow-md' : 'bg-bg-card border-border-main text-text-muted hover:border-[#137fec]/30 hover:text-[#137fec]'}`}>
 Last Day
 </button>
 </div>
 )}

 {repeatMode === 'Periodically' && (
 <div className="flex items-center gap-5">
 <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Repeat Every</span>
 <div className="flex items-center bg-bg-card border-2 border-border-main rounded-2xl overflow-hidden shadow-sm">
 <input type="number" min="1" value={repeatIntervalDays} onChange={e => setRepeatIntervalDays(e.target.value)} className="w-20 px-4 py-2.5 text-[14px] font-black text-text-muted text-center outline-none bg-transparent" />
 <div className="px-6 py-2.5 border-l-2 border-border-main text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50/50">Days</div>
 </div>
 </div>
 )}

 {repeatMode === 'Custom' && (
 <div className="flex flex-col gap-6">
 <div className="flex flex-wrap items-center gap-6">
 <div className="flex items-center gap-3">
 <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Occur Every</span>
 <div className="relative group">
 <select value={customOccurValue} onChange={e => setCustomOccurValue(e.target.value)} className="appearance-none bg-bg-card border-2 border-border-main rounded-2xl px-6 py-2.5 pr-10 text-[12px] font-black text-text-muted outline-none hover:border-[#137fec]/30 transition-all cursor-pointer shadow-sm">
 {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(v => <option key={v} value={v}>{v}</option>)}
 </select>
 <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#137fec] pointer-events-none" />
 </div>
 </div>
 <div className="relative group">
 <select value={occurEveryMode} onChange={e => setOccurEveryMode(e.target.value)} className="appearance-none bg-bg-card border-2 border-border-main rounded-2xl px-8 py-2.5 pr-12 text-[12px] font-black text-[#137fec] outline-none hover:border-[#137fec]/30 transition-all cursor-pointer shadow-sm uppercase tracking-widest">
 <option value="Week">Week</option>
 <option value="Month">Month</option>
 </select>
 <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#137fec] pointer-events-none" />
 </div>
 </div>

 <div className="flex flex-col gap-4">
 <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Select Days :</span>
 <div className="flex flex-wrap gap-2">
 {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => {
 const isSelected = customOccurDays.includes(day);
 return (
 <button key={day} onClick={() => setCustomOccurDays(prev => isSelected ? prev.filter(d => d !== day) : [...prev, day])} className={`px-5 py-2.5 rounded-2xl border-2 font-black text-[10px] tracking-widest transition-all ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white shadow-md' : 'bg-bg-card border-border-main text-text-muted hover:border-indigo-400 hover:text-indigo-500'}`}>
 {day}
 </button>
 );
 })}
 </div>
 </div>
 </div>
 )}
 </div>
 )}
 </div>

 <div className="flex flex-col gap-3">
 {links.length > 0 && <div className="flex flex-wrap gap-2">{links.map((link, i) => <div key={i} className="flex items-center gap-3 bg-[#137fec]/10 border-2 border-blue-100/50 px-4 py-2 rounded-2xl text-[11px] font-black text-[#137fec] shadow-sm group animate-in zoom-in-90"><Globe size={16} /> <span className="truncate max-w-[200px]">{link}</span> <X size={16} className="cursor-pointer text-text-muted group-hover:text-red-500" onClick={() => setLinks(prev => prev.filter((_, idx) => idx !== i))} /></div>)}</div>}
 {attachments.length > 0 && <div className="flex flex-wrap gap-2">{attachments.map((file, i) => <div key={i} className="flex items-center gap-3 bg-bg-main border-2 border-border-main px-4 py-2 rounded-2xl text-[11px] font-black text-text-muted shadow-sm group animate-in zoom-in-90"><Paperclip size={16} /> <span className="truncate max-w-[200px]">{file.name}</span> <X size={16} className="cursor-pointer text-text-muted group-hover:text-red-500" onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} /></div>)}</div>}
 </div>
 </div>

 <div className="p-5 px-7 flex items-center justify-between border-t border-border-main bg-bg-card/90 backdrop-blur-xl sm:rounded-b-[2.5rem] relative">
 <div className="flex items-center gap-2">
 <button onClick={() => openModal('attachment')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border-2 ${attachments.length > 0 ? 'border-[#137fec] text-[#137fec] bg-blue-50 shadow-blue-500/10' : 'border-border-main text-text-muted hover:text-[#137fec] hover:border-[#137fec]/30 hover:bg-blue-50 dark:hover:bg-slate-800'}`} title="Attach Files"><Paperclip size={18} /></button>
 <button onClick={() => openModal('reminder')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border-2 ${reminders.length > 0 ? 'border-[#137fec] text-[#137fec] bg-blue-50 shadow-blue-500/10' : 'border-border-main text-text-muted hover:text-[#137fec] hover:border-[#137fec]/30 hover:bg-blue-50 dark:hover:bg-slate-800'}`} title="Set Reminders"><Clock size={18} /></button>
 <button onClick={() => openModal('voice')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border-2 ${voiceState === 'recorded' ? 'border-[#137fec] text-[#137fec] bg-blue-50 shadow-blue-500/10' : 'border-border-main text-text-muted hover:text-[#137fec] hover:border-[#137fec]/30 hover:bg-blue-50 dark:hover:bg-slate-800'}`} title="Voice Note"><Mic size={18} /></button>
 </div>
 <button onClick={handleSubmit} disabled={isSubmitting} className="group relative px-10 py-3 bg-[#137fec] hover:bg-blue-600 text-white font-black rounded-2xl text-[12px] transition-all flex items-center gap-3 shadow-xl shadow-blue-500/25 active:scale-95 disabled:opacity-50 uppercase tracking-[0.2em] overflow-hidden">
 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
 {isSubmitting ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Upload size={16} strokeWidth={3} className="group-hover:-translate-y-1 transition-transform" />}
 {isSubmitting ? 'Processing...' : (initialData?.id ? 'Update Task' : 'Assign Task')}
 </button>
 <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple />
 <input type="file" ref={imageInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" multiple />
 </div>

 {activeModal === 'date' && (
 <ActionModal title={`Select deadline`} onClose={() => setActiveModal(null)} onSave={() => { if (!tempSelectedDate) return; const finalDate = new Date(tempSelectedDate); if (dateTarget === 'dueDate') { let h = parseInt(tempSelectedTime.hours); if (tempSelectedTime.ampm === 'PM' && h < 12) h += 12; if (tempSelectedTime.ampm === 'AM' && h === 12) h = 0; finalDate.setHours(h, parseInt(tempSelectedTime.minutes), 0, 0); setFormData(prev => ({ ...prev, dueDate: finalDate })); } else if (dateTarget === 'repeatStartDate') setRepeatStartDate(formatLocalDate(finalDate)); else setRepeatEndDate(formatLocalDate(finalDate)); setActiveModal(null); }}>
 <div className="flex flex-col gap-6">
 {dateTarget === 'dueDate' && (
 <div className="flex bg-border-main p-1 rounded-2xl self-center">
 <button onClick={() => setDatePickerView('date')} className={`px-8 py-2 rounded-xl text-[11px] font-black uppercase transition-all ${datePickerView === 'date' ? 'bg-bg-card text-[#137fec] shadow-sm' : 'text-text-muted'}`}>Date</button>
 <button onClick={() => setDatePickerView('time')} className={`px-8 py-2 rounded-xl text-[11px] font-black uppercase transition-all ${datePickerView === 'time' ? 'bg-bg-card text-[#137fec] shadow-sm' : 'text-text-muted'}`}>Time</button>
 </div>
 )}
 {datePickerView === 'date' ? (
 <div className="animate-in fade-in duration-300">
 <div className="flex items-center justify-between mb-4">
 <span className="text-sm font-black text-text-main uppercase bg-blue-50 px-4 py-2 rounded-xl">{currentCalMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
 <div className="flex gap-1">
 <button onClick={() => setCurrentCalMonth(new Date(currentCalMonth.getFullYear(), currentCalMonth.getMonth() - 1, 1))} className="w-8 h-8 rounded-lg bg-bg-card border border-border-main flex items-center justify-center text-text-muted hover:text-[#137fec]"><ChevronLeft size={16} /></button>
 <button onClick={() => setCurrentCalMonth(new Date(currentCalMonth.getFullYear(), currentCalMonth.getMonth() + 1, 1))} className="w-8 h-8 rounded-lg bg-bg-card border border-border-main flex items-center justify-center text-text-muted hover:text-[#137fec]"><ChevronRight size={16} /></button>
 </div>
 </div>
 <div className="grid grid-cols-7 gap-1 text-center font-black text-[10px] text-text-muted uppercase mb-2">
 {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
 </div>
 <div className="grid grid-cols-7 gap-1">
 {Array.from({ length: getFirstDayOfMonth(currentCalMonth.getFullYear(), currentCalMonth.getMonth()) }).map((_, i) => <div key={i} />)}
 {Array.from({ length: getDaysInMonth(currentCalMonth.getFullYear(), currentCalMonth.getMonth()) }).map((_, i) => {
 const d = i + 1;
 const dateObj = new Date(currentCalMonth.getFullYear(), currentCalMonth.getMonth(), d);
 const today = new Date();
 today.setHours(0, 0, 0, 0);
 const isPast = dateObj < today;

 // Simple isSameDate implementation if not found
 const isSameDate = (d1, d2) => d1 && d2 && d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

 const isSelected = tempSelectedDate && isSameDate(tempSelectedDate, dateObj);
 const isToday = isSameDate(new Date(), dateObj);

 return (
 <button
 key={d}
 onClick={() => !isPast && setTempSelectedDate(dateObj)}
 disabled={isPast}
 className={`w-8 h-8 mx-auto rounded-lg text-[11px] font-black transition-all 
 ${isSelected ? 'bg-[#137fec] text-white shadow-md' : 
 isPast ? 'text-text-muted/30 cursor-not-allowed' :
 isToday ? 'border-2 border-blue-100 text-[#137fec]' : 
 'text-text-main hover:bg-blue-50 dark:hover:bg-slate-800'}`}
 >
 {d}
 </button>
 );
 })}
 </div>
 </div>
 ) : (
 <div className="flex items-center justify-center gap-6 py-6 font-black">
 <div className="flex items-center gap-4">
 {/* Hours */}
 <div className="flex flex-col items-center gap-2">
 <button onClick={() => {
 let h = parseInt(tempSelectedTime.hours);
 h = h >= 12 ? 1 : h + 1;
 const val = h.toString().padStart(2, '0');
 setTempSelectedTime(p => ({ ...p, hours: val }));
 setTypedHour(val);
 }} className="w-10 h-10 rounded-xl bg-bg-main flex items-center justify-center text-text-muted hover:text-[#137fec] hover:bg-blue-50 transition-all">
 <ChevronDown size={24} className="rotate-180" strokeWidth={3} />
 </button>
 <input 
 type="text"
 value={typedHour}
 onChange={(e) => {
 const val = e.target.value.replace(/\D/g, '').slice(0, 2);
 if (val === '' || (parseInt(val, 10) >= 0 && parseInt(val, 10) <= 12)) setTypedHour(val);
 const num = parseInt(val, 10);
 if (num >= 1 && num <= 12) {
 setTempSelectedTime(p => ({ ...p, hours: num.toString().padStart(2, '0') }));
 }
 }}
 onBlur={() => setTypedHour(tempSelectedTime.hours)}
 className="w-20 h-24 bg-bg-card border-2 border-border-main rounded-[2rem] flex items-center justify-center text-center text-4xl font-black text-text-main shadow-sm leading-none outline-none focus:border-[#137fec]/30 transition-all"
 />
 <button onClick={() => {
 let h = parseInt(tempSelectedTime.hours);
 h = h <= 1 ? 12 : h - 1;
 const val = h.toString().padStart(2, '0');
 setTempSelectedTime(p => ({ ...p, hours: val }));
 setTypedHour(val);
 }} className="w-10 h-10 rounded-xl bg-bg-main flex items-center justify-center text-text-muted hover:text-[#137fec] hover:bg-blue-50 transition-all">
 <ChevronDown size={24} strokeWidth={3} />
 </button>
 </div>

 <div className="text-4xl font-black text-slate-200 mb-6">:</div>

 {/* Minutes */}
 <div className="flex flex-col items-center gap-2">
 <button onClick={() => {
 let m = parseInt(tempSelectedTime.minutes);
 m = m >= 59 ? 0 : m + 1;
 const val = m.toString().padStart(2, '0');
 setTempSelectedTime(p => ({ ...p, minutes: val }));
 setTypedMin(val);
 }} className="w-10 h-10 rounded-xl bg-bg-main flex items-center justify-center text-text-muted hover:text-[#137fec] hover:bg-blue-50 transition-all">
 <ChevronDown size={24} className="rotate-180" strokeWidth={3} />
 </button>
 <input 
 type="text"
 value={typedMin}
 onChange={(e) => {
 const val = e.target.value.replace(/\D/g, '').slice(0, 2);
 if (val === '' || (parseInt(val, 10) >= 0 && parseInt(val, 10) <= 59)) setTypedMin(val);
 const num = parseInt(val, 10);
 if (num >= 0 && num <= 59) {
 setTempSelectedTime(p => ({ ...p, minutes: num.toString().padStart(2, '0') }));
 }
 }}
 onBlur={() => setTypedMin(tempSelectedTime.minutes)}
 className="w-20 h-24 bg-bg-card border-2 border-border-main rounded-[2rem] flex items-center justify-center text-center text-4xl font-black text-text-main shadow-sm leading-none outline-none focus:border-[#137fec]/30 transition-all"
 />
 <button onClick={() => {
 let m = parseInt(tempSelectedTime.minutes);
 m = m <= 0 ? 59 : m - 1;
 const val = m.toString().padStart(2, '0');
 setTempSelectedTime(p => ({ ...p, minutes: val }));
 setTypedMin(val);
 }} className="w-10 h-10 rounded-xl bg-bg-main flex items-center justify-center text-text-muted hover:text-[#137fec] hover:bg-blue-50 transition-all">
 <ChevronDown size={24} strokeWidth={3} />
 </button>
 </div>

 <div className="flex flex-col gap-2">
 {['AM', 'PM'].map(p => <button key={p} onClick={() => setTempSelectedTime(prev => ({ ...prev, ampm: p }))} className={`px-4 py-2 rounded-xl text-[12px] border-2 transition-all ${tempSelectedTime.ampm === p ? 'bg-[#137fec] border-[#137fec] text-white' : 'bg-bg-card border-border-main text-text-muted'}`}>{p}</button>)}
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
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
 <input type="text" placeholder="Search team..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="w-full bg-bg-main border border-border-main rounded-xl py-2.5 pl-10 pr-4 text-sm font-bold outline-none focus:border-blue-500/30 text-text-muted" autoFocus />
 </div>
 <div className="max-h-[40vh] overflow-y-auto px-1 flex flex-col gap-1.5 custom-scrollbar">
 {filteredUsers.map(u => {
 const uid = u.userId || u.id || u.User_Id;
 const isSelected = formData.doerId.includes(uid);
 return (
 <div key={uid} onClick={() => toggleUserSelect(uid, 'doerId')} className={`p-3.5 rounded-2xl cursor-pointer flex items-center gap-4 transition-all border-2 ${isSelected ? 'bg-[#137fec]/10 border-[#137fec] shadow-sm' : 'border-border-main bg-bg-card hover:bg-bg-main hover:border-border-main dark:hover:border-slate-700'}`}>
 <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#137fec] to-blue-600 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-lg shadow-blue-500/20">
 { (u.firstName || u.name)?.[0] }
 </div>
 <div className="flex-1 min-w-0">
 <div className="text-[13px] font-black text-text-main truncate">{u.firstName || u.name} {u.lastName || ''}</div>
 <div className="text-[10px] font-bold text-text-muted truncate uppercase tracking-tighter">{u.email || u.workEmail}</div>
 </div>
 <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isSelected ? 'bg-[#137fec] text-white' : 'bg-bg-main text-text-muted'}`}>
 {isSelected ? <Check size={14} strokeWidth={4} /> : <div className="w-2 h-2 rounded-full bg-slate-200" />}
 </div>
 </div>
 );
 })}
 {filteredUsers.length === 0 && renderEmptyState()}
 </div>
 </div>
 </ActionModal>
 )}

 {activeModal === 'department' && (
 <ActionModal title="Select Department" onClose={() => setActiveModal(null)} onSave={() => setActiveModal(null)}>
 <div className="flex flex-col gap-4">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
 <input type="text" placeholder="Find department..." value={departmentSearch} onChange={e => setDepartmentSearch(e.target.value)} className="w-full bg-bg-main border border-border-main rounded-xl py-2.5 pl-10 pr-4 text-sm font-bold outline-none text-text-muted" autoFocus />
 </div>
 <div className="max-h-[40vh] overflow-y-auto p-1 flex flex-col gap-1.5">
 {isMasterLoading ? (
 <div className="py-10 text-center flex flex-col items-center gap-3">
 <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
 <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Loading Departments</span>
 </div>
 ) : filteredDepartments.length === 0 ? (
 <div className="py-10 text-center text-[10px] font-black text-text-muted uppercase tracking-widest">No departments found</div>
 ) : filteredDepartments.map((dept) => (
 <button key={dept.id} onClick={() => { setFormData(prev => ({ ...prev, department: dept.name })); setActiveModal(null); }} className={`text-left px-5 py-4 rounded-2xl text-[12px] font-black transition-all flex items-center justify-between border-2 ${formData.department === dept.name ? 'text-[#137fec] bg-[#137fec]/10 border-[#137fec] shadow-sm' : 'text-text-main border-border-main bg-bg-card hover:bg-bg-main hover:border-border-main dark:hover:border-slate-700'}`}>
 <div className="flex items-center gap-3">
 <Building2 size={18} className={formData.department === dept.name ? 'text-[#137fec]' : 'text-text-muted'} />
 {dept.name}
 </div>
 {formData.department === dept.name && <Check size={16} strokeWidth={4} className="text-[#137fec]" />}
 </button>
 ))}
 </div>
 </div>
 </ActionModal>
 )}

 {activeModal === 'category' && (
 <ActionModal title="Select Category" onClose={() => setActiveModal(null)} onSave={() => setActiveModal(null)} showAdd={true} onAdd={() => setIsAddCategoryModalOpen(true)}>
 <div className="flex flex-col gap-4">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
 <input type="text" placeholder="Find category..." value={categorySearch} onChange={e => setCategorySearch(e.target.value)} className="w-full bg-bg-main border border-border-main rounded-xl py-2.5 pl-10 pr-4 text-sm font-bold outline-none text-text-muted" autoFocus />
 </div>
 <div className="max-h-[40vh] overflow-y-auto p-1 flex flex-col gap-1.5">
 {filteredCategories.map(c => (
 <div key={c.id} className={`group flex items-center gap-2 transition-all`}>
 <button onClick={() => { setFormData(prev => ({ ...prev, category: c.name })); setActiveModal(null); }} className={`flex-1 text-left px-5 py-4 rounded-2xl text-[12px] font-black transition-all flex items-center justify-between border-2 ${formData.category === c.name ? 'text-[#137fec] bg-[#137fec]/10 border-[#137fec] shadow-sm' : 'text-text-main border-border-main bg-bg-card hover:bg-bg-main hover:border-border-main dark:hover:border-slate-700'}`}>
 <div className="flex items-center gap-3">
 <div className="w-4 h-4 rounded-full shadow-inner" style={{ backgroundColor: c.color }} /> 
 {c.name}
 </div>
 {formData.category === c.name && <Check size={16} strokeWidth={4} className="text-[#137fec]" />}
 </button>
 <button onClick={(e) => { e.stopPropagation(); handleDeleteCategory(c.id); }} className="w-12 h-[60px] rounded-2xl border-2 border-border-main bg-bg-card flex items-center justify-center text-text-muted hover:text-red-500 hover:border-red-100 dark:hover:border-red-900/30 transition-all opacity-0 group-hover:opacity-100 shadow-sm">
 <Trash2 size={18} />
 </button>
 </div>
 ))}
 </div>
 </div>
 </ActionModal>
 )}
 {activeModal === 'inLoop' && (
 <ActionModal title="Add Team in Loop" onClose={() => setActiveModal(null)} onSave={() => setActiveModal(null)} saveText="Apply Selection">
 <div className="flex flex-col gap-4">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
 <input type="text" placeholder="Search team members..." value={loopSearch} onChange={e => setLoopSearch(e.target.value)} className="w-full bg-bg-main border border-border-main rounded-xl py-2.5 pl-10 pr-4 text-sm font-bold outline-none focus:border-blue-500/30 text-text-muted" autoFocus />
 </div>
 <div className="max-h-[40vh] overflow-y-auto px-1 flex flex-col gap-1.5 custom-scrollbar">
 {filteredLoopUsers.map(u => {
 const uid = u.userId || u.id || u.User_Id;
 const isSelected = formData.inLoopIds.includes(uid);
 return (
 <div key={uid} onClick={() => toggleUserSelect(uid, 'inLoopIds')} className={`p-3.5 rounded-2xl cursor-pointer flex items-center gap-4 transition-all border-2 ${isSelected ? 'bg-indigo-50/50 border-indigo-500 shadow-sm' : 'border-border-main bg-bg-card hover:bg-bg-main hover:border-border-main dark:hover:border-slate-700'}`}>
 <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-lg shadow-indigo-500/20">
 { (u.firstName || u.name)?.[0] }
 </div>
 <div className="flex-1 min-w-0">
 <div className="text-[13px] font-black text-text-main truncate">{u.firstName || u.name} {u.lastName || ''}</div>
 <div className="text-[10px] font-bold text-text-muted truncate uppercase tracking-tighter">{u.email || u.workEmail}</div>
 </div>
 <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-500 text-white' : 'bg-bg-main text-text-muted'}`}>
 {isSelected ? <Check size={14} strokeWidth={4} /> : <div className="w-2 h-2 rounded-full bg-slate-200" />}
 </div>
 </div>
 );
 })}
 {filteredLoopUsers.length === 0 && renderEmptyState()}
 </div>
 </div>
 </ActionModal>
 )}

 {activeModal === 'attachment' && (
 <ActionModal title="Add Attachments" onClose={() => setActiveModal(null)} onSave={() => setActiveModal(null)} showAdd={true} onAdd={() => fileInputRef.current?.click()}>
 <div className="flex flex-col gap-2.5">
 {attachments.length === 0 ? (
 <div className="text-center py-12 flex flex-col items-center gap-4">
 <div className="w-16 h-16 rounded-[2rem] bg-bg-main/50 flex items-center justify-center text-slate-200">
 <Paperclip size={32} />
 </div>
 <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">No attachments yet</span>
 </div>
 ) : (
 attachments.map((file, i) => (
 <div key={i} className="flex items-center justify-between bg-bg-card p-4 rounded-2xl border-2 border-border-main shadow-sm animate-in slide-in-from-bottom-2 duration-300">
 <div className="flex items-center gap-4 overflow-hidden">
 <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-[#137fec]">
 <Paperclip size={18} />
 </div>
 <div className="flex flex-col overflow-hidden">
 <span className="text-[12px] font-black text-text-muted truncate">{file.name}</span>
 <span className="text-[9px] font-bold text-text-muted uppercase tracking-tighter">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
 </div>
 </div>
 <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"><X size={18} /></button>
 </div>
 ))
 )}
 </div>
 </ActionModal>
 )}

 {activeModal === 'reminder' && (
 <ActionModal title="Task Reminders" onClose={() => setActiveModal(null)} onSave={() => setActiveModal(null)} showAdd={true} onAdd={addReminder}>
 <div className="flex flex-col gap-3">
 {reminders.map((reminder, idx) => (
 <div key={reminder.id} className="bg-bg-card rounded-[1.5rem] p-5 border-2 border-border-main shadow-sm relative group animate-in slide-in-from-bottom-2 duration-300">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 <Clock size={14} className="text-[#137fec]" />
 <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">Reminder {idx + 1}</span>
 </div>
 <button onClick={() => removeReminder(reminder.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"><X size={16} /></button>
 </div>
 <div className="flex items-center gap-3">
 <div className="flex-1 bg-bg-main rounded-xl px-3 py-2 border border-border-main">
 <input type="number" value={reminder.timingValue} onChange={e => updateReminder(reminder.id, 'timingValue', e.target.value)} className="w-full bg-transparent text-[13px] font-black text-text-muted outline-none" />
 </div>
 <select value={reminder.timingUnit} onChange={e => updateReminder(reminder.id, 'timingUnit', e.target.value)} className="bg-bg-main border border-border-main rounded-xl px-4 py-2.5 text-[11px] font-black outline-none text-text-main cursor-pointer hover:border-[#137fec]/30 transition-all appearance-none uppercase tracking-widest">
 <option value="minutes">Minutes</option>
 <option value="hours">Hours</option>
 <option value="days">Days</option>
 </select>
 <select value={reminder.timingRelation} onChange={e => updateReminder(reminder.id, 'timingRelation', e.target.value)} className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-[11px] font-black outline-none text-[#137fec] cursor-pointer hover:border-[#137fec]/50 transition-all appearance-none uppercase tracking-widest">
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
 <div className="flex flex-col items-center justify-center py-10 gap-6">
 {voiceState === 'idle' && (
 <>
 <div className="w-24 h-24 rounded-[2.5rem] bg-bg-main flex items-center justify-center text-text-muted ring-8 ring-slate-50/50">
 <Mic size={40} />
 </div>
 <button onClick={() => {
 setIsRecording(true); setVoiceState('recording'); setRecordingTime(0);
 if (navigator.mediaDevices?.getUserMedia) {
 navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
 mediaRecorderRef.current = new MediaRecorder(stream);
 audioChunksRef.current = [];
 mediaRecorderRef.current.ondataavailable = (e) => {
 if (e.data.size > 0) audioChunksRef.current.push(e.data);
 };
 mediaRecorderRef.current.onstop = () => {
 const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
 setAudioBlob(blob);
 setVoiceState('recorded');
 setIsRecording(false);
 };
 mediaRecorderRef.current.start();
 }).catch(err => {
 console.error('Error accessing microphone:', err);
 toast.error('Could not access microphone');
 setVoiceState('idle');
 });
 }
 }} className="px-10 py-4 bg-[#137fec] hover:bg-blue-600 text-white font-black rounded-[2rem] text-[11px] transition-all flex items-center gap-3 shadow-xl shadow-blue-500/25 active:scale-95 uppercase tracking-[0.2em]">
 <Mic size={18} strokeWidth={3} /> Start Recording
 </button>
 </>
 )}
 {voiceState === 'recording' && (
 <div className="flex flex-col items-center gap-6">
 <div className="relative">
 <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20" />
 <div className="w-24 h-24 rounded-[2.5rem] bg-red-500/10 flex items-center justify-center text-red-500 relative z-10 border-2 border-red-500/20">
 <Mic size={40} className="animate-pulse" />
 </div>
 </div>
 <div className="flex flex-col items-center gap-1">
 <span className="text-[28px] font-black text-text-main tracking-tight">{Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</span>
 <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] animate-pulse">Recording...</span>
 </div>
 <button onClick={() => {
 if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
 mediaRecorderRef.current.stop();
 mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
 }
 }} className="px-10 py-4 bg-primary text-white font-black rounded-[2rem] text-[11px] transition-all flex items-center gap-3 shadow-xl active:scale-95 uppercase tracking-[0.2em]">
 <Square size={16} fill="currentColor" className="text-white" /> Stop Recording
 </button>
 </div>
 )}
 {voiceState === 'recorded' && (
 <div className="flex flex-col items-center gap-6 w-full px-4">
 <div className="w-24 h-24 rounded-[2.5rem] bg-green-500/10 flex items-center justify-center text-green-500 border-2 border-green-500/20">
 <Check size={40} strokeWidth={3} />
 </div>
 <div className="flex flex-col items-center gap-1">
 <span className="text-[10px] font-black text-green-500 uppercase tracking-[0.2em]">Voice Note Captured</span>
 </div>
 <div className="w-full bg-bg-main p-4 rounded-2xl flex items-center gap-4 border border-border-main">
 <button onClick={() => {
 const audio = new Audio(URL.createObjectURL(audioBlob));
 audio.play();
 }} className="w-12 h-12 rounded-xl bg-bg-card flex items-center justify-center text-[#137fec] shadow-sm border border-border-main hover:scale-105 transition-transform">
 <Play size={20} fill="currentColor" />
 </button>
 <div className="flex-1 h-2 bg-bg-main rounded-full overflow-hidden">
 <div className="h-full bg-[#137fec] w-full animate-progress" />
 </div>
 <button onClick={() => { setAudioBlob(null); setVoiceState('idle'); }} className="text-text-muted hover:text-red-500 transition-colors">
 <Trash2 size={20} />
 </button>
 </div>
 </div>
 )}
 </div>
 </ActionModal>
 )}

 {isAddCategoryModalOpen && (
 <ActionModal title="New Category" onClose={() => setIsAddCategoryModalOpen(false)} onSave={handleSaveCategory} saveText="Create Category">
 <div className="flex flex-col gap-6">
 <div className="flex flex-col gap-2">
 <label className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1">Category Name</label>
 <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="e.g. Marketing, Design, Sales" className="w-full bg-bg-main border-2 border-border-main rounded-2xl py-4 px-6 text-[13px] font-black outline-none focus:border-[#137fec] text-text-muted transition-all shadow-inner" autoFocus />
 </div>
 <div className="flex flex-col gap-3">
 <label className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1">Select Color</label>
 <div className="grid grid-cols-6 gap-3 p-1">
 {categoryColors.map(color => (
 <button key={color} onClick={() => setSelectedColor(color)} className={`w-10 h-10 rounded-xl transition-all relative flex items-center justify-center hover:scale-110 active:scale-95 ${selectedColor === color ? 'ring-4 ring-blue-500/20 scale-110 shadow-lg' : 'opacity-60 hover:opacity-100'}`} style={{ backgroundColor: color }}>
 {selectedColor === color && <Check size={16} className="text-white" strokeWidth={4} />}
 </button>
 ))}
 </div>
 </div>
 </div>
 </ActionModal>
 )}
 </div>
 </div>
 );
};

export default TaskCreationForm;
