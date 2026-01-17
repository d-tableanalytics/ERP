import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import MainLayout from '../../components/layout/MainLayout';
import HelpTicketForm from '../../components/HelpTicket/HelpTicketForm';
import HelpTicketTracker from '../../components/HelpTicket/HelpTicketTracker';
import { toast } from 'react-hot-toast';

const HelpTicket = () => {
    const { token } = useSelector((state) => state.auth);
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);

    const fetchTickets = async () => {
        try {
            const response = await fetch('/api/help-tickets', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setTickets(data);
            }
        } catch (error) {
            console.error('Error fetching tickets:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchTickets();
    }, [token]);

    const handleFormSuccess = () => {
        fetchTickets();
        setIsFormOpen(false);
    };

    const getPriorityColor = (priority) => {
        switch (priority?.toLowerCase()) {
            case 'high': return 'bg-red-500/10 text-red-500 border-red-500/20';
            case 'medium': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
            case 'low': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
        }
    };

    return (
        <MainLayout title="Help Ticket System">
            <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative min-h-screen">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-text-main tracking-tight">Help Desk</h1>
                        <p className="text-text-muted text-sm font-medium">Raise tickets, track progress, and resolve issues efficiently.</p>
                    </div>
                    <button
                        onClick={() => setIsFormOpen(true)}
                        className="bg-primary text-white font-bold py-2.5 px-6 rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined">add_circle</span>
                        Raise New Ticket
                    </button>
                </div>

                {/* Ticket List & Tracking */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">list_alt</span>
                            Active Tickets
                        </h2>
                        <span className="bg-bg-card border border-border-main px-3 py-1 rounded-full text-xs font-bold text-text-muted">
                            {tickets.length} TOTAL
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-bg-card border border-border-main rounded-2xl border-dashed">
                            <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
                            <p className="text-text-muted font-medium">Loading your tickets...</p>
                        </div>
                    ) : tickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-bg-card border border-border-main rounded-2xl border-dashed text-center">
                            <span className="material-symbols-outlined text-6xl text-text-muted mb-4 opacity-20">history_edu</span>
                            <h3 className="text-lg font-bold text-text-main">No Tickets Found</h3>
                            <p className="text-text-muted max-w-xs mx-auto text-sm">You haven't raised any tickets yet. Click "Raise New Ticket" to get started.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {tickets.map((ticket) => (
                                <div key={ticket.id} className="bg-bg-card border border-border-main rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group hover:border-primary/30 flex flex-col h-full">
                                    <div className="p-6 flex-1 flex flex-col">
                                        {/* Ticket Header */}
                                        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-black text-primary tracking-wider uppercase">#{ticket.help_ticket_no}</span>
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase ${getPriorityColor(ticket.priority)}`}>
                                                    {ticket.priority}
                                                </span>
                                            </div>
                                            <span className="text-xs font-bold text-text-muted bg-bg-main px-3 py-1 rounded-lg">
                                                {new Date(ticket.created_at).toLocaleDateString()}
                                            </span>
                                        </div>

                                        <div className="mb-4 space-y-2 flex-1">
                                            <span className="text-xs font-bold text-text-muted flex items-center gap-1">
                                                <span className="material-symbols-outlined text-sm">location_on</span>
                                                {ticket.location}
                                            </span>
                                            <h3 className="text-lg font-bold text-text-main leading-tight line-clamp-2">{ticket.issue_description}</h3>
                                        </div>

                                        {ticket.image_upload && (
                                            <div className="mb-4">
                                                <a href={ticket.image_upload} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-sm">attachment</span>
                                                    View Attachment
                                                </a>
                                            </div>
                                        )}

                                        {/* Tracker Section */}
                                        <div className="mb-6 pt-4 border-t border-border-main/50">
                                            <HelpTicketTracker currentStage={ticket.current_stage} />
                                        </div>

                                        {/* Footer Info */}
                                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-main/50">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-tighter">Raised By</span>
                                                <span className="text-xs font-bold text-text-main truncate">{ticket.raiser_name}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-tighter">PC Owner</span>
                                                <span className="text-xs font-bold text-text-main truncate">{ticket.pc_name || 'Unassigned'}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-tighter">Solver</span>
                                                <span className="text-xs font-bold text-text-main truncate">{ticket.solver_name || 'Unassigned'}</span>
                                            </div>
                                            <div className="flex flex-col justify-end">
                                                <button className="bg-bg-main hover:bg-border-main text-text-main font-bold py-1.5 px-3 rounded-lg text-xs transition-colors flex items-center gap-2 justify-center w-full">
                                                    View Details
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Offcanvas Overlay & Panel */}
                {/* Backdrop */}
                <div
                    className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${isFormOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }`}
                    onClick={() => setIsFormOpen(false)}
                ></div>

                {/* Sliding Panel */}
                <div
                    className={`fixed top-0 right-0 h-full w-full md:w-[480px] bg-bg-card shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isFormOpen ? 'translate-x-0' : 'translate-x-full'
                        }`}
                >
                    <div className="h-full flex flex-col">
                        <div className="p-4 border-b border-border-main flex items-center justify-between bg-bg-main/50">
                            <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                                New Request
                            </h2>
                            <button
                                onClick={() => setIsFormOpen(false)}
                                className="size-8 flex items-center justify-center rounded-full hover:bg-bg-main text-text-muted transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden p-4">
                            <HelpTicketForm onSuccess={handleFormSuccess} />
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};

export default HelpTicket;
