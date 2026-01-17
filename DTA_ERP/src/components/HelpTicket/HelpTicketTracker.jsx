import React from 'react';

const HelpTicketTracker = ({ currentStage }) => {
    const stages = [
        { id: 1, label: 'Raised', icon: 'campaign' },
        { id: 2, label: 'Planning', icon: 'event_note' },
        { id: 3, label: 'Solving', icon: 'build_circle' },
        { id: 4, label: 'Confirmation', icon: 'verified' },
        { id: 5, label: 'Closed', icon: 'task_alt' }
    ];

    return (
        <div className="w-full py-4 px-2">
            <div className="flex items-center justify-between relative">
                {/* Connector Line Base */}
                <div className="absolute top-1/2 left-0 w-full h-1 bg-border-main -translate-y-1/2 z-0 rounded-full"></div>

                {/* Active Connector Line */}
                <div
                    className="absolute top-1/2 left-0 h-1 bg-primary -translate-y-1/2 z-0 transition-all duration-500 rounded-full"
                    style={{ width: `${((currentStage - 1) / (stages.length - 1)) * 100}%` }}
                ></div>

                {stages.map((stage) => {
                    const isActive = stage.id <= currentStage;
                    const isCurrent = stage.id === currentStage;

                    return (
                        <div key={stage.id} className="relative z-10 flex flex-col items-center gap-3">
                            <div
                                className={`size-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${isActive
                                        ? 'bg-primary text-white scale-110'
                                        : 'bg-bg-card border-2 border-border-main text-text-muted'
                                    } ${isCurrent ? 'ring-4 ring-primary/20' : ''}`}
                            >
                                <span className="material-symbols-outlined text-[24px]">
                                    {isActive && stage.id < currentStage ? 'check' : stage.icon}
                                </span>
                            </div>
                            <div className="text-center">
                                <p className={`text-[11px] font-bold uppercase tracking-wider ${isActive ? 'text-primary' : 'text-text-muted'
                                    }`}>
                                    {stage.label}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default HelpTicketTracker;
