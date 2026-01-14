import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import MainLayout from '../../components/layout/MainLayout';
import CreateChecklistModal from '../../components/checklist/CreateChecklistModal';
import { fetchChecklists, deleteChecklist, updateChecklistTask } from '../../store/slices/checklistSlice';
import Loader from '../../components/common/Loader';
import toast from 'react-hot-toast';

const Checklist = () => {
    const dispatch = useDispatch();
    const { checklists, isLoading } = useSelector((state) => state.checklist);
    const [selectedChecklist, setSelectedChecklist] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [deletingId, setDeletingId] = useState(null);
    const [updatingId, setUpdatingId] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

    useEffect(() => {
        if (checklists.length === 0) {
            dispatch(fetchChecklists());
        }
    }, [dispatch, checklists.length]);

    const handleCreateSuccess = () => {
        dispatch(fetchChecklists());
    };

    const handleEdit = (item) => {
        setSelectedChecklist(item);
        setIsModalOpen(true);
    };



    const handleDelete = async (id) => {
        if (confirm('Delete this checklist task?')) {
            setDeletingId(id);
            try {
                await dispatch(deleteChecklist(id)).unwrap();
                toast.success('Checklist task deleted successfully');
            } catch (error) {
                console.error('Failed to delete:', error);
                toast.error('Failed to delete task');
            } finally {
                setDeletingId(null);
            }
        }
    };

    const handleToggleStatus = async (item) => {
        const newStatus = item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
        setUpdatingId(item.id);

        try {
            // Optimistic Update implied by direct Redux update, just need to dispatch
            await dispatch(updateChecklistTask({ id: item.id, status: newStatus })).unwrap();
            toast.success(`Task marked as ${newStatus.toLowerCase()}`);
        } catch (error) {
            console.error('Failed to update status:', error);
            toast.error('Failed to update status');
        } finally {
            setUpdatingId(null);
        }
    };

    // Filter Logic
    const filteredChecklists = checklists.filter(item =>
        item.question?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.department?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Pagination Logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredChecklists.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredChecklists.length / itemsPerPage);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    return (
        <MainLayout title="Checklist Management">
            <div className="flex flex-col gap-4 p-2">

                {/* Header Description */}
                <div className="flex justify-between items-center">
                    <p className="text-xs text-text-muted">Manage recurring tasks with automated scheduling</p>
                </div>

                {/* Toolbar */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-bg-card border border-border-main rounded-xl p-2 shadow-sm">
                    {/* Search Bar */}
                    <div className="relative w-full md:w-96">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-lg">search</span>
                        <input
                            type="text"
                            placeholder="Search checklists..."
                            className="w-full bg-bg-main border border-border-main rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1); // Reset to page 1 on search
                            }}
                        />
                    </div>

                    {/* Add Button */}
                    <button
                        onClick={() => {
                            setSelectedChecklist(null);
                            setIsModalOpen(true);
                        }}
                        className="w-full md:w-auto bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded-lg font-bold transition-all shadow-md shadow-yellow-400/20 flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Add Checklist
                    </button>
                </div>

                {/* Content Area */}
                <div className="min-h-[400px]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-12">
                            <Loader className="w-48 h-48" />
                            <p className="mt-2 text-text-muted font-bold text-sm">Loading checklists...</p>
                        </div>
                    ) : filteredChecklists.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-20 bg-bg-card border border-border-main rounded-2xl">
                            <span className="material-symbols-outlined text-5xl text-text-muted opacity-20 mb-3">checklist</span>
                            <p className="font-bold text-text-muted">No checklists found.</p>
                            <button
                                onClick={() => {
                                    setSelectedChecklist(null);
                                    setIsModalOpen(true);
                                }}
                                className="mt-4 text-xs font-bold text-primary hover:underline"
                            >
                                Create your first checklist
                            </button>
                        </div>
                    ) : (
                        <div className="bg-bg-card border border-border-main rounded-2xl overflow-hidden shadow-sm flex flex-col">
                            {/* Table WITHOUT internal scrollbar (except for very small screens/x-overflow) */}
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-sm text-left border-collapse min-w-[1200px]">
                                    <thead>
                                        <tr className="bg-yellow-400 text-black font-black uppercase tracking-wider text-[10px] border-b border-yellow-500/20">
                                            <th className="px-5 py-4">ID</th>
                                            <th className="px-5 py-4 w-1/4">Question/Task</th>
                                            <th className="px-5 py-4">Assignee</th>
                                            <th className="px-5 py-4">Doer</th>
                                            <th className="px-5 py-4">Priority</th>
                                            <th className="px-5 py-4">Department</th>
                                            <th className="px-5 py-4">Frequency</th>
                                            <th className="px-5 py-4">Due Date</th>
                                            <th className="px-5 py-4">Status</th>
                                            <th className="px-5 py-4">Verification</th>
                                            <th className="px-5 py-4 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-main">
                                        {currentItems.map((item) => (
                                            <tr key={item.id} className="hover:bg-bg-main/20 transition-colors group">
                                                <td className="px-5 py-4 font-bold text-text-main text-xs">#{item.id}</td>
                                                <td className="px-5 py-4 font-bold text-text-main text-xs">{item.question || item.task}</td>

                                                {/* Assignee */}
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="size-6 rounded-full bg-yellow-100 text-yellow-800 flex items-center justify-center font-bold text-[10px] uppercase border border-yellow-200">
                                                            {(item.assignee_name || item.assignee || '?').toString().charAt(0)}
                                                        </div>
                                                        <span className="text-xs font-medium text-text-main">
                                                            {item.assignee_name || item.assignee || 'Unassigned'}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Doer */}
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="size-6 rounded-full bg-yellow-400 text-black flex items-center justify-center font-bold text-[10px] uppercase">
                                                            {(item.doer_name || item.doer || '?').toString().charAt(0)}
                                                        </div>
                                                        <span className="text-xs font-medium text-text-main">
                                                            {item.doer_name || item.doer || 'Unassigned'}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Priority */}
                                                <td className="px-5 py-4">
                                                    <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${item.priority === 'high' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                        item.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                                            'bg-green-500/10 text-green-500 border-green-500/20'
                                                        }`}>
                                                        {item.priority}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4 text-xs font-medium text-text-main">{item.department}</td>

                                                {/* Frequency */}
                                                <td className="px-5 py-4">
                                                    <span className="inline-flex px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[9px] font-bold uppercase tracking-wider">
                                                        {item.frequency}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4 text-xs font-bold text-text-main">
                                                    {item.due_date ? new Date(item.due_date).toLocaleDateString() : (item.created_at ? new Date(item.created_at).toLocaleDateString() : '-')}
                                                </td>

                                                {/* Status */}
                                                <td className="px-5 py-4">
                                                    <button
                                                        onClick={() => handleToggleStatus(item)}
                                                        disabled={updatingId === item.id}
                                                        className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm transition-all hover:brightness-110 disabled:opacity-50 ${item.status === 'COMPLETED' ? 'bg-green-500 text-white shadow-green-500/20' : 'bg-red-500 text-white shadow-red-500/20'
                                                            }`}
                                                    >
                                                        {updatingId === item.id ? (
                                                            <span className="flex items-center gap-1">
                                                                <div className="size-2 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                                Updating...
                                                            </span>
                                                        ) : (
                                                            item.status
                                                        )}
                                                    </button>
                                                </td>

                                                <td className="px-5 py-4 text-[10px] text-text-muted uppercase tracking-wider">
                                                    {item.verification_required ? 'Yes' : 'No'}
                                                </td>

                                                {/* Actions */}
                                                <td className="px-5 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => handleEdit(item)}
                                                            className="text-blue-500 hover:text-blue-400 transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">edit_square</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(item.id)}
                                                            disabled={deletingId === item.id}
                                                            className="text-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
                                                        >
                                                            {deletingId === item.id ? (
                                                                <div className="size-4 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
                                                            ) : (
                                                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                                            )}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Footer */}
                            <div className="bg-bg-card border-t border-border-main p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                                <div className="text-sm text-text-muted">
                                    Showing <span className="font-bold text-text-main">{indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredChecklists.length)}</span> of <span className="font-bold text-text-main">{filteredChecklists.length}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => paginate(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="px-4 py-2 bg-bg-main border border-border-main rounded-lg text-sm font-medium text-text-main disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 hover:text-white transition-colors"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => paginate(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        className="px-4 py-2 bg-bg-main border border-border-main rounded-lg text-sm font-medium text-text-main disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 hover:text-white transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>

            <CreateChecklistModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleCreateSuccess}
                checklistToEdit={selectedChecklist}
            />
        </MainLayout>
    );
};

export default Checklist;
