import React, { useState } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useNavigate } from 'react-router-dom';
import enUS from 'date-fns/locale/en-US';

const locales = {
    'en-US': enUS,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

// Custom Toolbar Component
const CustomToolbar = (toolbar) => {
    const goToBack = () => toolbar.onNavigate('PREV');
    const goToNext = () => toolbar.onNavigate('NEXT');
    const goToCurrent = () => toolbar.onNavigate('TODAY');

    return (
        <div className="flex justify-between items-center mb-6 p-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">
                {format(toolbar.date, 'MMMM yyyy')}
            </h2>
            <div className="flex items-center gap-2 bg-slate-800/50 p-1.5 rounded-xl border border-slate-700/50">
                <button className="text-slate-400 hover:text-white transition-colors p-1" onClick={goToBack}>
                    <span className="material-symbols-outlined text-xl">chevron_left</span>
                </button>
                <button
                    className="bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-1.5 rounded-lg text-sm font-bold transition-all active:scale-95"
                    onClick={goToCurrent}
                >
                    Today
                </button>
                <button className="text-slate-400 hover:text-white transition-colors p-1" onClick={goToNext}>
                    <span className="material-symbols-outlined text-xl">chevron_right</span>
                </button>
            </div>
        </div>
    );
};

// Custom Date Header to match reference
const CustomDateHeader = ({ label, date, delegations }) => {
    const dayDelegations = delegations.filter(d =>
        new Date(d.due_date).toDateString() === date.toDateString()
    );

    return (
        <div className="flex items-center justify-between p-2">
            <span className="text-base font-bold text-slate-200">{label}</span>
            {dayDelegations.length > 0 && (
                <div className="size-6 rounded-full bg-yellow-400 text-black flex items-center justify-center text-[10px] font-extrabold shadow-sm shadow-yellow-400/20">
                    {dayDelegations.length}
                </div>
            )}
        </div>
    );
};

// Custom Event Component with Hover Actions
const CustomEvent = ({ event, user, isAdmin, onEdit, onDelete }) => {
    const [isHovered, setIsHovered] = useState(false);
    const navigate = useNavigate();
    const canManage = isAdmin || event.resource?.delegator_id === user?.id;

    // Determine background color based on priority
    const priority = event.resource?.priority?.toLowerCase();
    let bgColor = '#ef4444'; // default red for high
    if (priority === 'medium') bgColor = '#2563eb'; // Deep Blue
    if (priority === 'low') bgColor = '#475569'; // Slate

    return (
        <div
            className="relative group h-full w-full flex items-center px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: bgColor }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex-1 min-w-0 pr-10">
                <p className="text-[10px] font-extrabold text-white truncate uppercase tracking-tight leading-tight">{event.title}</p>
                <p className="text-[9px] font-bold text-white/80 truncate capitalize">{event.resource?.doer_name}</p>
            </div>

            {/* Hover Action Overlay - Perfectly centered inside the right side */}
            {isHovered && (
                <div className="absolute right-1 top-1 bottom-1 w-[92px] bg-[#1a202c]/95 rounded-md flex items-center justify-around z-50 animate-in fade-in slide-in-from-right-1 duration-200 border border-white/10 shadow-lg">
                    <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/delegation/${event.id}`); }}
                        className="text-yellow-400 hover:scale-110 transition-transform h-8 w-8 flex items-center justify-center p-0"
                        title="View"
                    >
                        <span className="material-symbols-outlined text-base">visibility</span>
                    </button>
                    {canManage && (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); onEdit(event.resource); }}
                                className="text-blue-500 hover:scale-110 transition-transform h-8 w-8 flex items-center justify-center p-0"
                                title="Edit"
                            >
                                <span className="material-symbols-outlined text-base">edit</span>
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(event.id); }}
                                className="text-red-500 hover:scale-110 transition-transform h-8 w-8 flex items-center justify-center p-0"
                                title="Delete"
                            >
                                <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

const DelegationCalendar = ({ delegations, user, isAdmin, onEdit, onDelete }) => {
    const [date, setDate] = useState(new Date());
    const [view, setView] = useState('month');
    const navigate = useNavigate();

    const events = delegations.map(d => ({
        id: d.id,
        title: d.delegation_name,
        start: new Date(d.due_date),
        end: new Date(d.due_date),
        allDay: true,
        resource: d
    }));

    const onNavigate = (newDate) => setDate(newDate);
    const onView = (newView) => setView(newView);

    const eventStyleGetter = (event) => {
        const priority = event.resource?.priority?.toLowerCase();
        let bgColor = '#ef4444'; // default red
        if (priority === 'medium') bgColor = '#2563eb'; // Deep Blue
        if (priority === 'low') bgColor = '#475569'; // Slate

        return {
            style: {
                backgroundColor: bgColor,
                borderRadius: '8px',
                border: 'none',
                padding: '0',
                marginBottom: '6px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1)',
                minHeight: '44px'
            }
        };
    };

    return (
        <div className="h-[800px] bg-[#0f172a] rounded-2xl p-6 border border-slate-700/50 shadow-2xl overflow-hidden flex flex-col">
            <style>{`
                .rbc-calendar { color: #cbd5e1; font-family: inherit; }
                .rbc-header { 
                    border-bottom: 1px solid #1e293b; 
                    padding: 16px 10px; 
                    font-weight: 800; 
                    color: #64748b; 
                    font-size: 11px; 
                    text-transform: uppercase; 
                    letter-spacing: 0.1em;
                }
                .rbc-month-view { 
                    border: 1px solid #1e293b; 
                    border-radius: 16px; 
                    overflow: hidden; 
                    background-color: #0b1121; 
                }
                .rbc-day-bg { 
                    border-left: 1px solid #1e293b; 
                    background-color: #0b1121;
                    transition: background-color 0.2s; 
                }
                .rbc-day-bg:hover { 
                    background-color: #1a202c; 
                }
                .rbc-month-row + .rbc-month-row { 
                    border-top: 1px solid #1e293b; 
                }
                .rbc-off-range-bg { 
                    background-color: #020617; 
                    opacity: 0.7; 
                }
                .rbc-today .rbc-day-bg {
                    background-color: #1e293b !important;
                }
                .rbc-date-cell {
                    padding: 0 !important;
                    text-align: left !important;
                }
                .rbc-event { 
                    padding: 0 !important; 
                    margin: 2px 8px !important; 
                    cursor: pointer;
                    overflow: visible !important;
                    background: none !important; /* Reset default background to avoid conflicts */
                    border: none !important;
                }
                /* Ensure the colored box is visible */
                .rbc-event > div:first-child {
                    height: 100%;
                    width: 100%;
                }
                .rbc-event:focus { outline: none; }
                .rbc-row-content {
                    z-index: 4;
                }
                .rbc-row-segment { 
                    padding: 0 !important; 
                }
                .rbc-show-more { 
                    color: #facc15; 
                    font-weight: 800; 
                    font-size: 10px; 
                    margin-left: 8px;
                    text-transform: uppercase;
                }
                .rbc-month-row {
                    overflow: visible !important;
                }
            `}</style>
            <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%' }}
                eventPropGetter={eventStyleGetter}
                views={['month']}
                view={view}
                date={date}
                onNavigate={onNavigate}
                onView={onView}
                showAllEvents={true}
                components={{
                    toolbar: CustomToolbar,
                    month: {
                        dateHeader: (props) => <CustomDateHeader {...props} delegations={delegations} />,
                        event: (props) => (
                            <CustomEvent
                                {...props}
                                user={user}
                                isAdmin={isAdmin}
                                onEdit={onEdit}
                                onDelete={onDelete}
                            />
                        )
                    }
                }}
            />
        </div>
    );
};

export default DelegationCalendar;
