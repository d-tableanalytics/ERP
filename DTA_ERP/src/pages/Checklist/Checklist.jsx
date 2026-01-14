import React, { useState } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import CreateChecklistModal from '../../components/checklist/CreateChecklistModal';

const Checklist = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Initial state without mock data
    const [checklists, setChecklists] = useState([]);

    const handleCreateSuccess = () => {
        // In real app, re-fetch. For now, just close.
        console.log('Refresh list...');
    };

    const handleDelete = (id) => {
        if (confirm('Delete this checklist?')) {
            setChecklists(checklists.filter(c => c.id !== id));
        }
    };

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
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Add Button */}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="w-full md:w-auto bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded-lg font-bold transition-all shadow-md shadow-yellow-400/20 flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Add Checklist
                    </button>
                </div>

                {/* Content Area */}
                <div className="min-h-[400px]">
                    {checklists.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-20 bg-bg-card border border-border-main rounded-2xl">
                            <span className="material-symbols-outlined text-5xl text-search-muted opacity-20 mb-3">checklist</span>
                            <p className="font-bold text-text-muted">No checklists found.</p>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="mt-4 text-xs font-bold text-primary hover:underline"
                            >
                                Create your first checklist
                            </button>
                        </div>
                    ) : (
                        <div className="bg-bg-card border border-border-main rounded-2xl overflow-hidden shadow-sm flex flex-col">
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
                                        {checklists.map((item) => (
                                            <tr key={item.id} className="hover:bg-bg-main/20 transition-colors group">
                                                <td className="px-5 py-4 font-bold text-text-main text-xs">#{item.id}</td>
                                                <td className="px-5 py-4 font-bold text-text-main text-xs">{item.task}</td>

                                                {/* Assignee */}
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="size-6 rounded-full bg-yellow-100 text-yellow-800 flex items-center justify-center font-bold text-[10px] uppercase border border-yellow-200">
                                                            {item.assignee.charAt(0)}
                                                        </div>
                                                        <span className="text-xs font-medium text-text-main">{item.assignee}</span>
                                                    </div>
                                                </td>

                                                {/* Doer */}
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="size-6 rounded-full bg-yellow-400 text-black flex items-center justify-center font-bold text-[10px] uppercase">
                                                            {item.doer.charAt(0)}
                                                        </div>
                                                        <span className="text-xs font-medium text-text-main">{item.doer}</span>
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

                                                <td className="px-5 py-4 text-xs font-bold text-text-main">{item.due_date}</td>

                                                {/* Status */}
                                                <td className="px-5 py-4">
                                                    <span className="inline-flex px-2 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-black uppercase tracking-wider shadow-sm shadow-red-500/20">
                                                        {item.status}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4 text-[10px] text-text-muted uppercase tracking-wider">{item.verification}</td>

                                                {/* Actions */}
                                                <td className="px-5 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button className="text-blue-500 hover:text-blue-400 transition-colors">
                                                            <span className="material-symbols-outlined text-[18px]">edit_square</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(item.id)}
                                                            className="text-red-500 hover:text-red-400 transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <CreateChecklistModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleCreateSuccess}
            />
        </MainLayout>
    );
};

export default Checklist;
