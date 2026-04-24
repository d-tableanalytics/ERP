import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Info,
  AlignLeft,
  User,
  Calendar,
  CheckCircle2,
  MoreVertical,
  ArrowLeft,
  Loader2,
  MessageSquare,
  ChevronRight,
  Clock,
  AlertCircle,
  PlayCircle,
  Paperclip,
  Mic,
  ShieldCheck,
  Trash2,
  Square,
  Play,
  Pause,
  StopCircle,
  Tag,
  Bell,
  BellOff,
  CheckSquare,
  Check,
  Layers,
  Plus,
  Pencil,
  ChevronDown,
  MessageCircle,
  History,
  Users,
  Download,
  ImageIcon,
  FileText,
  Maximize2,
  Volume2,
  ExternalLink,
  Eye,
} from "lucide-react";
import { toast } from "react-hot-toast";
import taskService from "../../services/taskService";
import delegationService from "../../services/delegationService";
import teamService from "../../services/teamService";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import CreateDelegationModal from "./CreateDelegationModal";
import TaskRemindersModal from "./TaskRemindersModal";
import CompleteTaskModal from "./CompleteTaskModal";
import TaskCreationForm from "./TaskCreationForm";

import usePermissions from "../../hooks/usePermissions";

const TaskDetailsDrawer = ({ isOpen, onClose, taskId, taskSource = 'task', onSuccess }) => {
  const { can, userId: loggedInUserId } = usePermissions();
  const [task, setTask] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("");

  const [remark, setRemark] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSubtaskModalOpen, setIsSubtaskModalOpen] = useState(false);
 
  const [isRemindersModalOpen, setIsRemindersModalOpen] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [subtasksExpanded, setSubtasksExpanded] = useState(true);

  const [selectedReferenceFiles, setSelectedReferenceFiles] = useState([]);
  const [selectedEvidenceFiles, setSelectedEvidenceFiles] = useState([]);
  const [selectedVoiceNote, setSelectedVoiceNote] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [voiceState, setVoiceState] = useState('idle'); // 'idle', 'recording', 'recorded'
  const [showRecorder, setShowRecorder] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const referenceDocsInputRef = useRef(null);
  const evidenceFilesInputRef = useRef(null);
  const voiceNoteInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && taskId) {
      fetchInitialData();
    }
  }, [isOpen, taskId]);

  useEffect(() => {
    let interval;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setSelectedVoiceNote(blob);
        setVoiceState('recorded');
        setIsRecording(false);
        // Stop all tracks
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setVoiceState('recording');
      setRecordingTime(0);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      toast.error('Could not access microphone');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleDeleteRecording = () => {
    setSelectedVoiceNote(null);
    setVoiceState('idle');
    setRecordingTime(0);
  };

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [taskRes, usersRes] = await Promise.all([
        taskSource === 'delegation' 
          ? delegationService.getDelegationById(taskId) 
          : taskService.getTaskById(taskId),
        teamService.getUsers(),
      ]);
      setTask(taskRes);
      setUsers(usersRes);
      setStatus(taskRes.status);
    } catch (err) {
      console.error("Failed to fetch initial data:", err);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const fetchTaskDetails = async () => {
    try {
      const response = await (taskSource === 'delegation' 
        ? delegationService.getDelegationById(taskId) 
        : taskService.getTaskById(taskId));
      setTask(response);
      setStatus(response.status);
    } catch (err) {
      console.error("Failed to fetch task details:", err);
    }
  };

  const handleQuickAction = (action) => {
    if (action === "Completed") {
      let parsedChecklist = [];
      try {
        parsedChecklist =
          typeof task.checklistItems === "string"
            ? JSON.parse(task.checklistItems)
            : task.checklistItems || [];
      } catch (e) {}

      if (
        parsedChecklist.length > 0 &&
        parsedChecklist.some((item) => !item.completed)
      ) {
        toast.error(
          "Please complete all checklist items before marking the task as Completed.",
        );
        return;
      }
    }
    setStatus(action);
  };

  const handleToggleChecklistItem = async (index) => {
    try {
      setSubmitting(true);
      let parsedChecklist = [];
      try {
        parsedChecklist =
          typeof task.checklistItems === "string"
            ? JSON.parse(task.checklistItems)
            : task.checklistItems || [];
      } catch (e) {}

      const updatedChecklist = [...parsedChecklist];
      updatedChecklist[index].completed = !updatedChecklist[index].completed;

      // Optimistic update
      setTask({ ...task, checklistItems: updatedChecklist });

      const storedUser = JSON.parse(localStorage.getItem("user"));
      const userId = storedUser?.user?.id || storedUser?.id;
      const itemName = updatedChecklist[index].itemName || updatedChecklist[index].text || `Item ${index + 1}`;

      const updates = {
        checklistItems: updatedChecklist,
        changedBy: userId,
        reason: `Checklist item '${itemName}' marked as ${updatedChecklist[index].completed ? "completed" : "incomplete"}.`,
      };

      if (taskSource === 'delegation') {
        await delegationService.updateDelegation(taskId, updates);
      } else {
        await taskService.updateTask(taskId, updates);
      }

      toast.success(
        updatedChecklist[index].completed
          ? `✅ "${itemName}" marked as complete`
          : `↩️ "${itemName}" marked as incomplete`,
        { duration: 2500 }
      );
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Failed to update checklist item:", err);
      toast.error("Failed to update checklist item. Please try again.");
      // Revert changes on error
      fetchTaskDetails();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitUpdate = async () => {
    const statusChanged = status !== task.status;
    const hasReferenceUploads = selectedReferenceFiles.length > 0;
    const hasEvidenceUploads = selectedEvidenceFiles.length > 0;
    const hasVoiceUpload = Boolean(selectedVoiceNote);
    const hasUploads = hasReferenceUploads || hasEvidenceUploads || hasVoiceUpload;
    if (!remark.trim() && !statusChanged && !hasUploads) return;

    const loadingToastId = toast.loading("Submitting update...");

    try {
      setSubmitting(true);
      setError(null);

      const storedUser = JSON.parse(localStorage.getItem("user"));
      const userId = storedUser?.user?.id || storedUser?.id;
      const existingEvidenceUrls = (() => {
        if (!task?.evidenceUrl) return [];
        if (Array.isArray(task.evidenceUrl)) return task.evidenceUrl.filter(Boolean);
        if (typeof task.evidenceUrl === "string") {
          const raw = task.evidenceUrl.trim();
          if (!raw) return [];
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed.filter(Boolean);
            return [raw];
          } catch (e) {
            return raw.split(",").map((entry) => entry.trim()).filter(Boolean);
          }
        }
        return [];
      })();

      // 1. If status changed, handle according to type
      if (statusChanged) {
        if (
          status === "Completed" &&
          task.evidenceRequired &&
          existingEvidenceUrls.length === 0 &&
          selectedEvidenceFiles.length === 0
        ) {
          if (remark.trim()) {
            const remarkPayload = { userId, remark: remark.trim() };
            if (taskSource === 'delegation') {
              await delegationService.addRemark(taskId, remarkPayload);
            } else {
              await taskService.addRemark(taskId, remarkPayload);
            }
            setRemark("");
          }
          toast.dismiss(loadingToastId);
          setShowCompleteModal(true);
          setSubmitting(false);
          return;
        }

        if (hasUploads) {
          const formData = new FormData();
          formData.append("status", status);
          formData.append("changedBy", String(userId));
          formData.append("reason", remark.trim() || `Status updated to ${status}`);
          selectedReferenceFiles.forEach((file) =>
            formData.append("reference_docs", file),
          );
          selectedEvidenceFiles.forEach((file) =>
            formData.append("evidence_files", file),
          );
          if (selectedVoiceNote) {
            formData.append("voice_note", selectedVoiceNote, "voice-note.webm");
          }
          if (taskSource === 'delegation') {
            await delegationService.updateDelegation(taskId, formData);
          } else {
            await taskService.updateTask(taskId, formData);
          }
        } else {
          const updates = {
            status: status,
            changedBy: userId,
            reason: remark.trim() || `Status updated to ${status}`,
          };
          if (taskSource === 'delegation') {
            await delegationService.updateDelegation(taskId, updates);
          } else {
            await taskService.updateTask(taskId, updates);
          }
        }
      } else if (hasUploads) {
        const formData = new FormData();
        formData.append("changedBy", String(userId));
        formData.append(
          "reason",
          remark.trim() || "Task attachments updated from quick actions",
        );
        selectedReferenceFiles.forEach((file) =>
          formData.append("reference_docs", file),
        );
        selectedEvidenceFiles.forEach((file) =>
          formData.append("evidence_files", file),
        );
        if (selectedVoiceNote) {
          formData.append("voice_note", selectedVoiceNote, "voice-note.webm");
        }
        if (taskSource === 'delegation') {
          await delegationService.updateDelegation(taskId, formData);
        } else {
          await taskService.updateTask(taskId, formData);
        }
      }

      if (remark.trim()) {
        const remarkPayload = { userId, remark: remark.trim() };
        if (taskSource === 'delegation') {
          await delegationService.addRemark(taskId, remarkPayload);
        } else {
          await taskService.addRemark(taskId, remarkPayload);
        }
        setRemark("");
      }

      setSelectedReferenceFiles([]);
      setSelectedEvidenceFiles([]);
      setSelectedVoiceNote(null);
      setVoiceState('idle');
      setShowRecorder(false);
      setRecordingTime(0);
      if (referenceDocsInputRef.current) referenceDocsInputRef.current.value = "";
      if (evidenceFilesInputRef.current) evidenceFilesInputRef.current.value = "";
      if (voiceNoteInputRef.current) voiceNoteInputRef.current.value = "";

      // Contextual success notification
      toast.dismiss(loadingToastId);
      if (statusChanged && hasUploads) {
        toast.success(`✅ Status changed to "${status}" with attachments uploaded!`, { duration: 3500 });
      } else if (statusChanged) {
        toast.success(`✅ Status changed to "${status}"`, { duration: 3000 });
      } else if (hasUploads) {
        const uploadParts = [
          hasEvidenceUploads && `${selectedEvidenceFiles.length || ""} evidence file(s)`,
          hasReferenceUploads && `${selectedReferenceFiles.length || ""} reference file(s)`,
          hasVoiceUpload && "voice note",
        ].filter(Boolean).join(", ");
        toast.success(`📎 Attachments uploaded successfully`, { duration: 3000 });
      } else if (remark.trim() !== "") {
        toast.success("💬 Remark added successfully", { duration: 2500 });
      } else {
        toast.success("Task updated successfully", { duration: 2500 });
      }

      await fetchTaskDetails();
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Failed to submit update:", err);
      toast.dismiss(loadingToastId);
      setError("Failed to submit update");
      toast.error("❌ Failed to update task. Please try again.", { duration: 4000 });
    } finally {
      setSubmitting(false);
    }
  };

  const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

  const appendValidFiles = (incomingFiles, setter, allowedPrefix = null) => {
    const files = Array.from(incomingFiles || []);
    const validFiles = [];
    let validationError = null;

    files.forEach((file) => {
      if (allowedPrefix && !file.type?.startsWith(allowedPrefix)) {
        validationError = `Only ${allowedPrefix.replace("/", "")} files are allowed for this upload.`;
        return;
      }
      if (file.size > MAX_UPLOAD_SIZE) {
        validationError = `File "${file.name}" exceeds the 50MB limit.`;
        return;
      }
      validFiles.push(file);
    });

    if (validationError) {
      toast.error(validationError);
    }
    if (validFiles.length > 0) {
      setter((prev) => [...prev, ...validFiles]);
    }
  };

  const removeSelectedFile = (setter, index) => {
    setter((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  };

  const getUserName = (userId) => {
    const user = users.find((u) => u.userId === userId || u.id === userId);
    return user ? `${user.firstName} ${user.lastName}` : `User ${userId}`;
  };

  const getUserInfo = (userId) => {
    const user = users.find((u) => u.userId === userId || u.id === userId);
    if (!user) return { name: `User ${userId}`, designation: "", initials: "?" };
    const name = `${user.firstName} ${user.lastName}`.trim();
    const initials = `${(user.firstName || "")[0] || ""}${(user.lastName || "")[0] || ""}`.toUpperCase();
    const designation = user.designation || user.department || "";
    return { name, designation, initials };
  };

  const getWatchers = () => {
    if (!task?.inLoopIds) return [];
    const ids = typeof task.inLoopIds === "string"
      ? (() => { try { return JSON.parse(task.inLoopIds); } catch { return []; } })()
      : task.inLoopIds;
    if (!Array.isArray(ids)) return [];
    return ids.filter(id => id !== task.assignerId && id !== task.doerId);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "Completed":
        return <CheckCircle2 size={16} className="text-[#137fec]" />;
      case "In Progress":
        return <PlayCircle size={16} className="text-orange-500" />;
      case "Pending":
        return <Clock size={16} className="text-slate-400" />;
      case "Overdue":
        return <AlertCircle size={16} className="text-red-500" />;
      case "Need Revision":
        return <MessageSquare size={16} className="text-blue-500" />;
      default:
        return <Clock size={16} className="text-slate-400" />;
    }
  };

  const handleDeleteTask = async () => {
    const loadingToastId = toast.loading("Deleting task...");
    try {
      setSubmitting(true);
      if (taskSource === 'delegation') {
        await delegationService.softDeleteDelegation(taskId);
      } else {
        await taskService.softDeleteTask(taskId);
      }
      toast.dismiss(loadingToastId);
      toast.success("🗑️ Record moved to trash successfully", { duration: 3000 });
      setShowDeleteConfirm(false);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Failed to delete task:", err);
      toast.dismiss(loadingToastId);
      toast.error("❌ Failed to delete task. Please try again.", { duration: 4000 });
    } finally {
      setSubmitting(false);
    }
  };

  const getCurrentUserId = () => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    return storedUser?.user?.id || storedUser?.id;
  };

  const isAssigner = () => task?.assignerId === getCurrentUserId();
  const isDoer = () => task?.doerId === getCurrentUserId();
  const isAssignerOrDoer = () =>
    task?.assignerId === getCurrentUserId() ||
    task?.doerId === getCurrentUserId();

  const getLoopIds = () =>
    typeof task?.inLoopIds === "string"
      ? JSON.parse(task?.inLoopIds)
      : task?.inLoopIds || [];
  const isSubscribed = () => {
    const loopIds = getLoopIds();
    return Array.isArray(loopIds) && loopIds.includes(getCurrentUserId());
  };

  const handleSubscribeToggle = async () => {
    if (!task) return;

    const currentUserId = getCurrentUserId();
    let loopIds = getLoopIds();

    if (loopIds.includes(currentUserId)) {
      toast("🔔 You are already subscribed to this task.", { duration: 2500 });
      return;
    }

    try {
      setSubmitting(true);
      if (!Array.isArray(loopIds)) loopIds = [];
      loopIds = [...loopIds, currentUserId];
      
      if (taskSource === 'delegation') {
        await delegationService.updateDelegation(taskId, { inLoopIds: loopIds });
      } else {
        await taskService.updateTask(taskId, { inLoopIds: loopIds });
      }
      
      await fetchTaskDetails();
      toast.success("🔔 You are now subscribed!", { duration: 3000 });
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Failed to toggle subscription:", err);
      toast.error("❌ Failed to subscribe to task. Please try again.", { duration: 4000 });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateSubtaskStatus = async (subtaskId, newStatus) => {
    const loadingToastId = toast.loading(`Updating subtask to "${newStatus}"...`);
    try {
      setSubmitting(true);
      const storedUser = JSON.parse(localStorage.getItem("user"));
      const userId = storedUser?.user?.id || storedUser?.id;

      const updates = {
        status: newStatus,
        changedBy: userId,
        reason: `Subtask status updated to ${newStatus}`,
      };

      if (taskSource === 'delegation') {
        await delegationService.updateDelegation(subtaskId, updates);
      } else {
        await taskService.updateTask(subtaskId, updates);
      }

      toast.dismiss(loadingToastId);
      toast.success(
        newStatus === "Completed"
          ? "✅ Subtask marked as Completed!"
          : `▶️ Subtask moved to "${newStatus}"`,
        { duration: 3000 }
      );
      await fetchTaskDetails();
    } catch (err) {
      console.error("Failed to update subtask status:", err);
      toast.dismiss(loadingToastId);
      toast.error("❌ Failed to update subtask status. Please try again.", { duration: 4000 });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveReminders = async (reminders) => {
    const loadingToastId = toast.loading("Saving reminders...");
    try {
      setSubmitting(true);
      const storedUser = JSON.parse(localStorage.getItem("user"));
      const userId = storedUser?.user?.id || storedUser?.id;

      await taskService.updateTask(taskId, {
        reminders: reminders,
        changedBy: userId,
        reason: "Task reminders updated",
      });

      toast.dismiss(loadingToastId);
      const count = Array.isArray(reminders) ? reminders.length : 0;
      toast.success(
        count > 0
          ? `🔔 ${count} reminder${count > 1 ? "s" : ""} saved successfully!`
          : "🔕 All reminders cleared",
        { duration: 3000 }
      );
      setIsRemindersModalOpen(false);
      await fetchTaskDetails();
    } catch (err) {
      console.error("Failed to save reminders:", err);
      toast.dismiss(loadingToastId);
      toast.error("❌ Failed to save reminders. Please try again.", { duration: 4000 });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-300"
        onClick={onClose}
      />

      <div className="absolute right-0 top-0 h-full w-full max-w-4xl bg-bg-card shadow-2xl transition-transform duration-300 transform translate-x-0 border-l border-border-main flex flex-col">
        {/* Header */}
        <div className="px-4.5 py-3 bg-bg-card border-b border-border-main flex items-center justify-between sticky top-0 z-[60]">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2 text-[10px] font-black text-text-muted uppercase tracking-tight">
              <span>Delegations</span>
              <ChevronRight size={10} className="text-slate-300 dark:text-slate-600" />
              <span className="text-[#137fec] dark:text-blue-400">Details</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`px-2.5 py-1 bg-bg-main/50 text-slate-600 dark:text-slate-300 text-[10px] font-black rounded-lg border border-border-main uppercase flex items-center gap-1.5 shadow-sm`}
            >
              {getStatusIcon(task?.status)}
              {task?.status}
            </div>
            {can("task", "delete") && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={submitting}
                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-lg transition-all"
                title="Delete Task"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-[#137fec]" size={32} />
              <p className="text-sm font-medium text-slate-500">
                Loading task details...
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-xl flex flex-col items-center gap-3 max-w-md text-center">
              <AlertCircle size={32} />
              <p className="font-bold">{error}</p>
              <button
                onClick={fetchInitialData}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4.5 space-y-4.5 custom-scrollbar bg-slate-50/30 dark:bg-slate-950/30">
            <h1 className="text-lg font-black text-text-main tracking-tight leading-tight">
              {task.taskTitle}
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-5">
                {/* Core Information */}
                <div className="bg-bg-card rounded-2xl border border-border-main p-4.5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-bg-main rounded-lg text-text-muted">
                      <Info size={14} />
                    </div>
                    <h2 className="text-[10px] font-black text-text-main uppercase tracking-widest opacity-80">
                      Core Information
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-start gap-x-10 gap-y-6">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Category
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 dark:text-indigo-400 rounded-lg">
                          <Tag size={13} />
                        </div>
                        <span className="text-xs font-black text-text-main">
                          {task.category || "N/A"}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Priority
                      </label>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${task.priority === "Urgent" ? "bg-red-500 shadow-red-500/20" : task.priority === "High" ? "bg-orange-500 shadow-orange-500/20" : task.priority === "Medium" ? "bg-indigo-500 shadow-indigo-500/20" : "bg-slate-400"} shadow-lg`}
                        />
                        <span className="text-xs font-black text-text-main">
                          {task.priority}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Deadline
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-500 dark:text-rose-400 rounded-lg">
                          <Calendar size={13} />
                        </div>
                        <span className="text-xs font-black text-text-main">
                          {task.dueDate
                            ? new Date(task.dueDate).toLocaleString("en-GB")
                            : "Not set"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Checklist */}
                {(() => {
                  let parsedChecklist = [];
                  try {
                    parsedChecklist =
                      typeof task.checklistItems === "string"
                        ? JSON.parse(task.checklistItems)
                        : task.checklistItems || [];
                  } catch (e) {}
                  if (!parsedChecklist || parsedChecklist.length === 0)
                    return null;
                  const completedCount = parsedChecklist.filter(
                    (item) => item.completed,
                  ).length;
                  return (
                    <div className="bg-bg-card rounded-2xl border border-border-main p-4.5 shadow-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="p-1.5 bg-[#137fec]/10 dark:bg-blue-900/20 rounded-lg text-[#137fec] dark:text-blue-400">
                          <CheckSquare size={14} />
                        </div>
                        <h2 className="text-[10px] font-black text-text-main uppercase tracking-widest opacity-80">
                          Checklist
                        </h2>
                        <span className="ml-auto text-[9px] font-black text-text-muted bg-bg-main px-2 py-0.5 rounded-lg border border-border-main">
                          {completedCount} / {parsedChecklist.length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {parsedChecklist.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 group"
                          >
                            <button
                              onClick={() => handleToggleChecklistItem(idx)}
                              disabled={submitting || !isDoer()}
                              className={`shrink-0 w-4.5 h-4.5 rounded-lg border transition-all flex items-center justify-center ${item.completed ? "bg-[#137fec] border-[#137fec] text-white" : "border-slate-200 dark:border-slate-700 bg-bg-main hover:border-[#137fec] dark:hover:border-blue-500"} shadow-sm`}
                            >
                              {item.completed && (
                                <Check size={10} strokeWidth={4} />
                              )}
                            </button>
                            <span
                              className={`text-xs font-black leading-snug flex-1 ${item.completed ? "text-slate-400 dark:text-slate-500 line-through" : "text-slate-600 dark:text-slate-300"}`}
                            >
                              {item.itemName || item.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Sub Tasks Section */}
                <div className="bg-bg-card rounded-2xl border border-border-main p-4.5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-sky-50 dark:bg-sky-900/20 rounded-lg text-sky-500 dark:text-sky-400">
                      <Layers size={14} />
                    </div>
                    <h2 className="text-[10px] font-black text-text-main uppercase tracking-widest opacity-80">Sub Tasks</h2>
                    <div className="flex items-center gap-2 ml-4">
                      <div className="px-2 py-0.5 rounded-lg bg-bg-main border border-border-main text-[9px] font-black text-text-muted">
                        {task.subtasks?.filter(s => s.status === 'Completed').length || 0} / {task.subtasks?.length || 0}
                      </div>
                      <button
                        onClick={() => setIsSubtaskModalOpen(true)}
                        className="w-6 h-6 rounded-lg bg-bg-main hover:bg-sky-500 dark:hover:bg-blue-600 hover:text-white flex items-center justify-center text-slate-400 transition-all border border-border-main shadow-sm"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button
                      onClick={() => setSubtasksExpanded(!subtasksExpanded)}
                      className="ml-auto p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors bg-bg-main rounded-lg"
                    >
                      <ChevronDown size={14} className={`transition-transform duration-300 ${subtasksExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {subtasksExpanded && (
                    <div className="space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-300">
                      {task.subtasks && task.subtasks.length > 0 ? (
                        task.subtasks.map((sub, idx) => (
                          <div
                            key={sub.id}
                            className="p-3.5 rounded-2xl border border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 hover:border-[#137fec]/30 transition-all cursor-pointer group shadow-sm"
                          >
                            <div className="flex justify-between items-start mb-2.5">
                              <h3 className="text-xs font-black text-text-main uppercase tracking-tight">T-{idx + 1} &nbsp; {sub.taskTitle}</h3>
                              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest whitespace-nowrap">
                                {(() => {
                                  const diff = Math.floor((new Date() - new Date(sub.createdAt)) / 60000);
                                  return diff < 60 ? `${diff}M AGO` : new Date(sub.createdAt).toLocaleDateString();
                                })()}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                              <div className="flex items-center gap-1.5 text-rose-500 bg-rose-50 dark:bg-rose-900/10 px-2 py-1 rounded-lg">
                                <Clock size={10} />
                                {sub.dueDate ? new Date(sub.dueDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'NA'}
                              </div>
                              <div className="flex items-center gap-1.5 bg-bg-card px-2 py-1 rounded-lg border border-border-main shadow-sm">
                                <div className={`w-1.5 h-1.5 rounded-full ${sub.status === 'Completed' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : 'bg-orange-500 shadow-lg shadow-orange-500/30'}`} />
                                <span className={sub.status === 'Completed' ? 'text-emerald-500' : 'text-orange-500'}>{sub.status}</span>
                              </div>
                              <div className="flex items-center gap-1.5 bg-bg-card px-2 py-1 rounded-lg border border-border-main shadow-sm">
                                <User size={10} />
                                {getUserName(sub.doerId)}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-4">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateSubtaskStatus(sub.id, 'In Progress');
                                }}
                                disabled={submitting || sub.status === 'In Progress'}
                                className="px-3 py-1.5 rounded-lg border border-orange-100 dark:border-orange-900/30 text-orange-500 bg-bg-card hover:bg-orange-50 dark:hover:bg-orange-900/20 text-[9px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                              >
                                <PlayCircle size={10} /> In Progress
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateSubtaskStatus(sub.id, 'Completed');
                                }}
                                disabled={submitting || sub.status === 'Completed'}
                                className="px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30 text-emerald-500 bg-bg-card hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-[9px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                              >
                                <CheckCircle2 size={10} /> Complete
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 border-2 border-dashed border-border-main rounded-2xl">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No sub tasks yet</p>
                          <button
                            onClick={() => setIsSubtaskModalOpen(true)}
                            className="mt-3 text-[10px] font-black text-sky-500 hover:text-sky-600 flex items-center gap-1.5 mx-auto bg-sky-50 dark:bg-sky-900/20 px-3 py-1.5 rounded-lg border border-sky-100 dark:border-sky-900 shadow-sm"
                          >
                            <Plus size={12} strokeWidth={3} /> CREATE SUB TASK
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                {isAssignerOrDoer() && (
                  <div className="space-y-4 pt-2">
                    <h2 className="text-[10px] font-black text-text-main uppercase tracking-widest opacity-80">
                      Quick Actions
                    </h2>
                    <div className="flex flex-wrap gap-2.5">
                      {isDoer() && (
                        <>
                          <button
                            onClick={() => handleQuickAction("In Progress")}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest shadow-sm ${status === "In Progress" ? "bg-orange-500 text-white border-orange-600" : "bg-bg-card text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-900/30 hover:bg-orange-50 dark:hover:bg-orange-900/10"}`}
                          >
                            <PlayCircle size={14} /> In Progress
                          </button>
                          <button
                            onClick={() => handleQuickAction("Completed")}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest shadow-sm ${status === "Completed" ? "bg-[#137fec] text-white border-[#106bc7]" : "bg-bg-card text-[#137fec] dark:text-blue-400 border-[#137fec]/20 dark:border-blue-900/30 hover:bg-blue-50 dark:hover:bg-blue-900/10"}`}
                          >
                            <CheckCircle2 size={14} /> Complete
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setIsRemindersModalOpen(true)}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border-main text-text-muted font-black text-[10px] uppercase tracking-widest bg-bg-card hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95"
                      >
                        <Bell size={14} /> REMINDERS
                      </button>
                    </div>

                    <div className="space-y-3 mt-4">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Quick Remark
                      </label>
                      <textarea
                        value={remark}
                        onChange={(e) => setRemark(e.target.value)}
                        placeholder="Focus on specific details or updates..."
                        rows={2}
                        className="w-full bg-bg-card border border-border-main rounded-2xl p-4 text-[13px] text-text-main focus:ring-4 focus:ring-[#137fec]/5 focus:border-[#137fec]/30 dark:focus:border-blue-500/50 outline-none transition-all resize-none font-medium"
                      />

                      {isDoer() && (
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                            Assignee Uploads
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => evidenceFilesInputRef.current?.click()}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-900/10 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                              <ImageIcon size={12} /> Image / File
                            </button>
                            <button
                              type="button"
                              onClick={() => referenceDocsInputRef.current?.click()}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-900/30 text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20 text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                              <Paperclip size={12} /> Reference Files
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowRecorder(!showRecorder)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all ${showRecorder ? "border-purple-600 bg-purple-600 text-white" : "border-purple-100 dark:border-purple-900/30 text-purple-600 dark:text-purple-400 bg-purple-50/60 dark:bg-purple-900/10 hover:bg-purple-100 dark:hover:bg-purple-900/20"}`}
                            >
                              <Mic size={12} /> {showRecorder ? "Close Recorder" : "Voice Note"}
                            </button>
                          </div>

                          {showRecorder && (
                            <div className="mt-2 p-4 bg-bg-card border border-purple-100 dark:border-purple-900/30 rounded-2xl flex flex-col items-center gap-4 animate-in slide-in-from-top-2 duration-300 shadow-sm">
                              {voiceState === 'idle' && (
                                <button
                                  type="button"
                                  onClick={handleStartRecording}
                                  className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-purple-500/20 hover:bg-purple-700 transition-all active:scale-95"
                                >
                                  <Mic size={14} /> Start Recording
                                </button>
                              )}
                              {voiceState === 'recording' && (
                                <div className="flex flex-col items-center gap-3 w-full">
                                  <div className="flex items-center gap-3 px-4 py-2 bg-bg-main rounded-xl border border-red-100 animate-pulse">
                                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                                    <span className="text-[20px] font-black text-text-main tabular-nums">
                                      {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={handleStopRecording}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-red-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all active:scale-95"
                                  >
                                    <StopCircle size={14} /> Stop Recording
                                  </button>
                                </div>
                              )}
                              {voiceState === 'recorded' && (
                                <div className="flex items-center gap-3 w-full">
                                  <div className="flex-1 flex items-center gap-2 p-2.5 bg-bg-main border border-border-main rounded-xl">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const audio = new Audio(URL.createObjectURL(selectedVoiceNote));
                                        audio.play();
                                      }}
                                      className="w-10 h-10 rounded-lg bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 shadow-md transition-all active:scale-95"
                                    >
                                      <Play size={16} fill="currentColor" />
                                    </button>
                                    <div className="flex flex-col">
                                      <span className="text-[10px] font-black text-text-main uppercase tracking-widest">Voice Note</span>
                                      <span className="text-[9px] font-bold text-text-muted">Ready to upload</span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={handleDeleteRecording}
                                    className="w-10 h-10 rounded-lg flex items-center justify-center text-text-muted hover:text-red-500 hover:bg-red-50 transition-all"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              )}
                              <div className="flex items-center gap-3 w-full">
                                <div className="flex-1 h-px bg-border-main" />
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Or</span>
                                <div className="flex-1 h-px bg-border-main" />
                              </div>
                              <button
                                type="button"
                                onClick={() => voiceNoteInputRef.current?.click()}
                                className="text-[10px] font-black text-purple-600 hover:text-purple-700 uppercase tracking-widest transition-colors flex items-center gap-1.5"
                              >
                                <Paperclip size={12} /> Select audio file instead
                              </button>
                            </div>
                          )}

                          <input
                            ref={evidenceFilesInputRef}
                            type="file"
                            className="hidden"
                            multiple
                            onChange={(e) => {
                              appendValidFiles(e.target.files, setSelectedEvidenceFiles);
                              e.target.value = "";
                            }}
                          />
                          <input
                            ref={referenceDocsInputRef}
                            type="file"
                            className="hidden"
                            multiple
                            onChange={(e) => {
                              appendValidFiles(e.target.files, setSelectedReferenceFiles);
                              e.target.value = "";
                            }}
                          />
                          <input
                            ref={voiceNoteInputRef}
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={(e) => {
                              const [file] = Array.from(e.target.files || []);
                              if (!file) return;
                              if (!file.type?.startsWith("audio/")) {
                                toast.error("Please upload a valid audio file.");
                                e.target.value = "";
                                return;
                              }
                              if (file.size > MAX_UPLOAD_SIZE) {
                                toast.error(`File "${file.name}" exceeds the 50MB limit.`);
                                e.target.value = "";
                                return;
                              }
                              setSelectedVoiceNote(new File([file], `voice_note_${new Date().getTime()}.webm`, { type: file.type }));
                              setVoiceState('recorded');
                              setShowRecorder(true);
                              e.target.value = "";
                            }}
                          />

                          {(selectedEvidenceFiles.length > 0 ||
                            selectedReferenceFiles.length > 0 ||
                            selectedVoiceNote) && (
                            <div className="space-y-2">
                              {selectedEvidenceFiles.map((file, index) => (
                                <div
                                  key={`evidence-${file.name}-${index}`}
                                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <ImageIcon size={12} className="text-emerald-500 shrink-0" />
                                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 truncate">
                                      {file.name}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeSelectedFile(setSelectedEvidenceFiles, index)
                                    }
                                    className="p-1 rounded-full text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ))}

                              {selectedReferenceFiles.map((file, index) => (
                                <div
                                  key={`reference-${file.name}-${index}`}
                                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-blue-50/70 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Paperclip size={12} className="text-blue-500 shrink-0" />
                                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 truncate">
                                      {file.name}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeSelectedFile(setSelectedReferenceFiles, index)
                                    }
                                    className="p-1 rounded-full text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ))}

                              {selectedVoiceNote && (
                                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-purple-50/70 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Mic size={12} className="text-purple-500 shrink-0" />
                                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 truncate">
                                      {selectedVoiceNote.name}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedVoiceNote(null)}
                                    className="p-1 rounded-full text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex justify-end mt-2">
                        <button
                          onClick={handleSubmitUpdate}
                          disabled={
                            submitting ||
                            (!remark.trim() &&
                              status === task?.status &&
                              selectedReferenceFiles.length === 0 &&
                              selectedEvidenceFiles.length === 0 &&
                              !selectedVoiceNote)
                          }
                          className={`py-2 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 ${remark.trim() || status !== task?.status || selectedReferenceFiles.length > 0 || selectedEvidenceFiles.length > 0 || selectedVoiceNote ? "bg-[#137fec] text-white shadow-[#137fec]/20" : "bg-bg-main text-slate-400 dark:text-slate-600 cursor-not-allowed"}`}
                        >
                          {submitting ? "SUBMITTING..." : "SUBMIT UPDATE"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar Info */}
              <div className="space-y-5">
                <div className="bg-bg-card rounded-2xl border border-border-main p-4.5 shadow-sm">
                  <h3 className="text-[10px] font-black text-text-main uppercase tracking-widest mb-4 opacity-80 flex items-center gap-2">
                    <Users size={12} /> Stakeholders
                  </h3>
                  <div className="space-y-4">
                    {/* Assigner */}
                    {(() => {
                      const info = getUserInfo(task.assignerId);
                      return (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs border border-indigo-100 dark:border-indigo-800/30 shadow-sm shrink-0">
                            {info.initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                              Assigner
                            </p>
                            <p className="text-xs font-black text-text-main truncate">
                              {info.name}
                            </p>
                            {info.designation && (
                              <p className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 truncate mt-0.5">
                                {info.designation}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Assignee */}
                    {(() => {
                      const info = getUserInfo(task.doerId);
                      return (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xs border border-emerald-100 dark:border-emerald-800/30 shadow-sm shrink-0">
                            {info.initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                              Assignee
                            </p>
                            <p className="text-xs font-black text-text-main truncate">
                              {info.name}
                            </p>
                            {info.designation && (
                              <p className="text-[9px] font-bold text-emerald-500 dark:text-emerald-400 truncate mt-0.5">
                                {info.designation}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Watchers */}
                    {(() => {
                      const watcherIds = getWatchers();
                      if (watcherIds.length === 0) return null;
                      return (
                        <div className="pt-3 border-t border-border-main">
                          <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                            <Eye size={10} /> Watchers ({watcherIds.length})
                          </p>
                          <div className="space-y-2.5">
                            {watcherIds.map((wId) => {
                              const info = getUserInfo(wId);
                              return (
                                <div key={wId} className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 flex items-center justify-center font-black text-[9px] border border-violet-100 dark:border-violet-800/30 shadow-sm shrink-0">
                                    {info.initials}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-black text-text-main truncate leading-tight">
                                      {info.name}
                                    </p>
                                    {info.designation && (
                                      <p className="text-[9px] font-bold text-violet-500 dark:text-violet-400 truncate">
                                        {info.designation}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Attachments Section */}
                {(() => {
                  const evidenceUrls = (() => {
                    if (!task?.evidenceUrl) return [];
                    if (Array.isArray(task.evidenceUrl)) return task.evidenceUrl.filter(Boolean);
                    if (typeof task.evidenceUrl === "string") {
                      const raw = task.evidenceUrl.trim();
                      if (!raw) return [];
                      try {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed)) return parsed.filter(Boolean);
                        return [raw];
                      } catch (e) {
                        return raw.split(",").map(s => s.trim()).filter(Boolean);
                      }
                    }
                    return [];
                  })();
                  const refDocs = task?.referenceDocsList || [];
                  const voice = task?.voiceNoteUrl;
                  const hasAttachments = evidenceUrls.length > 0 || refDocs.length > 0 || voice;

                  if (!hasAttachments) return null;

                  return (
                    <div className="bg-bg-card rounded-2xl border border-border-main p-4.5 shadow-sm">
                      <h3 className="text-[10px] font-black text-text-main uppercase tracking-widest mb-4 opacity-80 flex items-center gap-2">
                        <Paperclip size={12} /> Attachments
                      </h3>
                      <div className="space-y-3">
                        {evidenceUrls.map((url, idx) => {
                          const fileName = url.split('/').pop()?.substring(0, 25) + '...';
                          return (
                          <a key={`ev-${idx}`} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors border border-emerald-100 dark:border-emerald-800/30 group">
                             <ImageIcon size={14} className="text-emerald-500 shrink-0" />
                             <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 truncate group-hover:text-[#137fec] transition-colors" title={url}>Evidence File {idx + 1}</span>
                          </a>
                        )})}
                        {refDocs.map((url, idx) => {
                          const fileName = url.split('/').pop()?.substring(0, 25) + '...';
                          return (
                          <a key={`ref-${idx}`} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors border border-blue-100 dark:border-blue-800/30 group">
                             <FileText size={14} className="text-blue-500 shrink-0" />
                             <span className="text-[10px] font-black text-blue-700 dark:text-blue-400 truncate group-hover:text-[#137fec] transition-colors" title={url}>Reference File {idx + 1}</span>
                          </a>
                        )})}
                        {voice && (
                          <div className="p-2 rounded-lg bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <Mic size={14} className="text-purple-500" />
                                <span className="text-[10px] font-black text-purple-700 dark:text-purple-400">Voice Note</span>
                              </div>
                              <a href={voice} target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:text-purple-600">
                                <ExternalLink size={12} />
                              </a>
                            </div>
                            <audio controls src={voice} className="w-full h-8" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Remarks Section */}
                {task?.remarks_detail?.length > 0 && (
                  <div className="bg-bg-card rounded-2xl border border-border-main p-4.5 shadow-sm">
                    <h3 className="text-[10px] font-black text-text-main uppercase tracking-widest mb-4 opacity-80 flex items-center gap-2">
                      <MessageSquare size={12} /> Remarks History
                    </h3>
                    <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                      {task.remarks_detail.map((rmk, idx) => (
                        <div key={idx} className="flex gap-3">
                          <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-800/30">
                            <span className="text-[8px] font-black uppercase">{rmk.username?.substring(0, 2)}</span>
                          </div>
                          <div className="flex-1 bg-bg-main/50 p-3 rounded-tr-xl rounded-b-xl border border-border-main">
                            <div className="flex justify-between items-start mb-1 gap-2">
                              <span className="text-[10px] font-black text-text-main truncate">{rmk.username}</span>
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest shrink-0 text-right">
                                {new Date(typeof rmk.createdAt === 'string' && !rmk.createdAt.endsWith('Z') ? rmk.createdAt + 'Z' : rmk.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{rmk.remark}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteTask}
        loading={submitting}
        message="Are you sure you want to delete this task? This action cannot be undone."
      />

      <TaskRemindersModal
        isOpen={isRemindersModalOpen}
        onClose={() => setIsRemindersModalOpen(false)}
        onSave={handleSaveReminders}
        initialReminders={
          typeof task?.reminders === "string"
            ? JSON.parse(task?.reminders)
            : task?.reminders || []
        }
      />

      <CompleteTaskModal
        isOpen={showCompleteModal}
        task={task}
        onClose={() => setShowCompleteModal(false)}
        onSuccess={() => {
          setShowCompleteModal(false);
          fetchTaskDetails();
          if (onSuccess) onSuccess();
        }}
      />

      {isSubtaskModalOpen && (
        <TaskCreationForm
          isOpen={isSubtaskModalOpen}
          onClose={() => setIsSubtaskModalOpen(false)}
          onSuccess={fetchTaskDetails}
          apiMode="task"
          parentId={taskId}
          initialData={{
            groupId: task?.groupId,
            inLoopIds: task?.inLoopIds
          }}
        />
      )}
    </div>
  );
};

export default TaskDetailsDrawer;



