import React from "react";

const ModuleTrends = () => {
  return (
    <div className="bg-bg-card border border-border-main rounded-2xl p-6 shadow-sm premium-card">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-sm font-black text-text-main uppercase tracking-widest leading-none mb-1.5">
            Completion Trends
          </h3>
          <p className="text-xs font-bold text-text-muted">
            Weekly overview of tasks and orders completed
          </p>
        </div>
        <select className="bg-bg-main border-2 border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest px-4 py-2 focus:ring-4 focus:ring-primary/10 text-text-main cursor-pointer transition-all outline-none">
          <option>This Week</option>
          <option>Last Week</option>
        </select>
      </div>

      <div className="h-[300px] w-full relative px-2">
        <svg
          className="overflow-visible"
          fill="none"
          height="100%"
          preserveAspectRatio="none"
          viewBox="0 0 478 150"
          width="100%"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#137fec" stopOpacity="0.2"></stop>
              <stop offset="100%" stopColor="#137fec" stopOpacity="0"></stop>
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[50, 100, 150].map((y) => (
            <line
              key={y}
              stroke="currentColor"
              className="text-border-main/30"
              strokeDasharray="4 4"
              strokeWidth="1"
              x1="0"
              x2="478"
              y1={y}
              y2={y}
            />
          ))}

          {/* Area fill */}
          <path
            d="M0 109 C50 109 50 40 100 40 C150 40 150 90 200 90 C250 90 250 30 300 30 C350 30 350 110 400 110 C440 110 440 60 478 60 V 150 H 0 Z"
            fill="url(#chartGradient)"
            className="transition-all duration-1000"
          ></path>

          {/* Line path */}
          <path
            d="M0 109 C50 109 50 40 100 40 C150 40 150 90 200 90 C250 90 250 30 300 30 C350 30 350 110 400 110 C440 110 440 60 478 60"
            fill="none"
            stroke="#137fec"
            strokeLinecap="round"
            strokeWidth="4"
            className="drop-shadow-[0_4px_12px_rgba(19,127,236,0.3)] transition-all duration-1000"
          ></path>

          {/* Data points */}
          {[
            { cx: 100, cy: 40 },
            { cx: 200, cy: 90 },
            { cx: 300, cy: 30 },
            { cx: 478, cy: 60 },
          ].map((point, i) => (
            <circle
              key={i}
              cx={point.cx}
              cy={point.cy}
              r="5"
              fill="white"
              stroke="#137fec"
              strokeWidth="3"
              className="shadow-xl"
            ></circle>
          ))}
        </svg>

        <div className="flex justify-between mt-8 text-[10px] text-text-muted font-black uppercase tracking-widest">
          <span>Week 1</span>
          <span>Week 2</span>
          <span>Week 3</span>
          <span>Week 4</span>
        </div>
      </div>
    </div>
  );
};

export default ModuleTrends;




