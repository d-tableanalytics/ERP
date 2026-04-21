import React, { useState, useEffect } from 'react';
import { X, Search, Check, Save, UserPlus, Users, Pencil, Trash2, ShieldCheck, Mail, MapPin, Briefcase, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import delegationService from '../../services/delegationService';
import teamService from '../../services/teamService';

const GroupDetailsModal = ({ isOpen, onClose, groupId, onSuccess }) => {
    const [groupData, setGroupData] = useState(null);
    const [members, setMembers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // Edit state
    const [editForm, setEditForm] = useState({
        name: '',
        description: '',
        imageUrl: '',
        members: []
    });
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [userSearch, setUserSearch] = useState('');

    useEffect(() => {
        if (isOpen && groupId) {
            fetchGroupAndMembers();
            fetchAllUsers();
        }
    }, [isOpen, groupId]);

    const fetchGroupAndMembers = async () => {
        try {
            setIsLoading(true);
            const [groupRes, membersRes] = await Promise.all([
                delegationService.getGroupById(groupId),
                delegationService.getGroupMembers(groupId)
            ]);
            
            if (groupRes.success) {
                setGroupData(groupRes.data);
                setEditForm({
                    name: groupRes.data.name,
                    description: groupRes.data.description || '',
                    imageUrl: groupRes.data.imageUrl || '',
                    members: membersRes.data.map(m => m.userId)
                });
                setImagePreview(groupRes.data.imageUrl);
            }
            if (membersRes.success) {
                setMembers(membersRes.data);
            }
        } catch (err) {
            console.error('Failed to fetch group info:', err);
            toast.error('Failed to load group details');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAllUsers = async () => {
        try {
            const data = await teamService.getUsers();
            setAllUsers(data);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        }
    };

    const handleSave = async () => {
        if (!editForm.name.trim()) {
            toast.error('Group name is required');
            return;
        }

        try {
            setIsSaving(true);
            
            let finalImageUrl = editForm.imageUrl;
            if (selectedImage) {
                const uploadRes = await delegationService.uploadFile(selectedImage, 'groups');
                if (uploadRes.success) {
                    finalImageUrl = uploadRes.url;
                }
            }

            const res = await delegationService.updateGroup(groupId, {
                name: editForm.name,
                description: editForm.description,
                imageUrl: finalImageUrl,
                members: editForm.members
            });

            if (res.success) {
                toast.success('Group updated successfully');
                setIsEditing(false);
                setSelectedImage(null);
                fetchGroupAndMembers();
                if (onSuccess) onSuccess();
            }
        } catch (err) {
            console.error('Failed to update group:', err);
            toast.error('Failed to update group');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleMember = (userId) => {
        setEditForm(prev => {
            const members = [...prev.members];
            const index = members.indexOf(userId);
            if (index > -1) {
                members.splice(index, 1);
            } else {
                members.push(userId);
            }
            return { ...prev, members };
        });
    };

    const filteredUsers = allUsers.filter(u => 
        (u.firstName + ' ' + u.lastName).toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(userSearch.toLowerCase())
    );

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[#1e2329] w-full max-w-[600px] rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50 bg-[#222831]/80 backdrop-blur-sm sticky top-0 z-10">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg overflow-hidden">
                            { (isEditing ? imagePreview : groupData?.imageUrl) ? (
                                <img src={isEditing ? imagePreview : groupData?.imageUrl} alt="Group" className="w-full h-full object-cover" />
                            ) : (
                                <Users size={16} className="text-white" />
                            )}
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white leading-tight">
                                {isEditing ? 'Edit Group' : (groupData?.name || 'Group Details')}
                            </h2>
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest opacity-70">
                                {isEditing ? 'Modify Information' : 'Information & Team'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {!isEditing && (
                            <button 
                                onClick={() => setIsEditing(true)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-800 text-slate-400 hover:text-white hover:bg-[#00d194]/20 transition-all border border-slate-700 hover:border-[#00d194]/50"
                            >
                                <Pencil size={14} />
                            </button>
                        )}
                        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                            <X size={16} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <div className="w-10 h-10 border-4 border-[#00d194] border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-slate-400 font-bold text-sm">Loading group details...</span>
                        </div>
                    ) : (
                        <>
                            {/* Basic Info Section */}
                            <div className="space-y-4">
                                {isEditing && (
                                    <div>
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Group Image</label>
                                        <div className="flex items-center gap-4">
                                            <div className="relative group/img">
                                                <div className="w-20 h-20 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-700 overflow-hidden flex items-center justify-center">
                                                    {imagePreview ? (
                                                        <img src={imagePreview} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Upload className="text-slate-600" size={24} />
                                                    )}
                                                </div>
                                                <input 
                                                    type="file" 
                                                    className="absolute inset-0 opacity-0 cursor-pointer" 
                                                    onChange={handleImageChange}
                                                    accept="image/*"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <button 
                                                    className="text-xs font-bold text-[#00d194] hover:bg-[#00d194]/10 px-3 py-1.5 rounded-lg transition-all"
                                                    onClick={() => document.querySelector('input[type="file"]').click()}
                                                >
                                                    Change Photo
                                                </button>
                                                {imagePreview && (
                                                    <button 
                                                        className="text-xs font-bold text-red-400 hover:bg-red-400/10 px-3 py-1.5 rounded-lg transition-all text-left"
                                                        onClick={() => { setSelectedImage(null); setImagePreview(null); setEditForm(prev => ({ ...prev, imageUrl: '' })); }}
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] block mb-1.5 opacity-70">Group Name</label>
                                    {isEditing ? (
                                        <input 
                                            type="text" 
                                            value={editForm.name}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                            className="w-full bg-[#12161b] border border-slate-700 focus:border-[#00d194]/50 rounded-xl px-3.5 py-1.5 text-white text-[11px] font-semibold outline-none transition-all shadow-inner"
                                            placeholder="Enter group name"
                                        />
                                    ) : (
                                        <div className="text-[12px] font-bold text-white bg-[#12161b]/30 p-2.5 rounded-xl border border-slate-800/50">
                                            {groupData?.name}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] block mb-1.5 opacity-70">Description</label>
                                    {isEditing ? (
                                        <textarea 
                                            value={editForm.description}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                            className="w-full bg-[#12161b] border border-slate-700 focus:border-[#00d194]/50 rounded-xl px-3.5 py-1.5 text-white text-[11px] font-semibold outline-none transition-all shadow-inner min-h-[50px] resize-none"
                                            placeholder="Add group description..."
                                        />
                                    ) : (
                                        <div className="text-[10px] font-medium text-slate-400 leading-relaxed bg-[#12161b]/30 p-2.5 rounded-xl border border-slate-800/50">
                                            {groupData?.description || 'No description provided'}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Members Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block opacity-70">
                                        Members <span className="text-[#00d194] ml-1">{isEditing ? editForm.members.length : members.length}</span>
                                    </label>
                                    {isEditing && (
                                        <div className="relative">
                                            <div className="flex items-center gap-2 bg-[#12161b] border border-slate-700 rounded-lg px-3 py-1.5 focus-within:border-[#00d194]/50 transition-all">
                                                <Search size={14} className="text-slate-500" />
                                                <input 
                                                    type="text" 
                                                    placeholder="Add more members..."
                                                    value={userSearch}
                                                    onChange={(e) => setUserSearch(e.target.value)}
                                                    className="bg-transparent text-xs text-white outline-none w-40"
                                                />
                                            </div>
                                            {userSearch && (
                                                <div className="absolute top-full right-0 mt-2 w-72 bg-[#222831] border border-slate-700 rounded-xl shadow-2xl z-[110] max-h-60 overflow-y-auto p-2 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2">
                                                    {filteredUsers.map(u => (
                                                        <div 
                                                            key={u.userId}
                                                            onClick={() => toggleMember(u.userId)}
                                                            className={`p-2 hover:bg-slate-800 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${editForm.members.includes(u.userId) ? 'bg-[#00d194]/10 border border-[#00d194]/30' : 'border border-transparent'}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white">
                                                                    {u.firstName[0]}{u.lastName[0]}
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-bold text-white">{u.firstName} {u.lastName}</span>
                                                                    <span className="text-[10px] text-slate-500 truncate w-32">{u.email}</span>
                                                                </div>
                                                            </div>
                                                            {editForm.members.includes(u.userId) && (
                                                                <Check size={16} className="text-[#00d194]" />
                                                            )}
                                                        </div>
                                                    ))}
                                                    {filteredUsers.length === 0 && (
                                                        <div className="p-4 text-center text-slate-500 text-xs font-bold">No users found</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {(isEditing ? allUsers.filter(u => editForm.members.includes(u.userId)) : members).map((member) => (
                                        <div key={member.userId} className="flex items-center gap-3 p-3 bg-[#12161b]/50 border border-slate-800/50 rounded-xl group hover:border-slate-700 transition-all">
                                            <div className="relative">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                                                    {member.firstName[0]}{member.lastName[0]}
                                                </div>
                                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#1e2329] rounded-full"></div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-white truncate">{member.firstName} {member.lastName}</div>
                                                <div className="text-[9px] text-slate-500 font-semibold truncate uppercase tracking-widest">
                                                    {member.designation || 'Member'}
                                                </div>
                                            </div>
                                            {isEditing && (
                                                <button 
                                                    onClick={() => toggleMember(member.userId)}
                                                    className="p-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                {isEditing && (
                    <div className="px-4 py-2.5 border-t border-slate-700/50 bg-[#222831]/80 flex items-center justify-end gap-2.5 sticky bottom-0 z-10">
                        <button 
                            onClick={() => setIsEditing(false)}
                            className="px-3 py-1.5 rounded-lg text-slate-400 font-bold text-[9px] hover:text-white transition-colors uppercase tracking-[0.15em]"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-4 py-2 rounded-lg bg-[#00d194] hover:bg-[#00ba84] text-white font-bold text-[9px] flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-[#00d194]/10 uppercase tracking-[0.15em]"
                        >
                            {isSaving ? (
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <Save size={12} />
                            )}
                            Save Changes
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GroupDetailsModal;
