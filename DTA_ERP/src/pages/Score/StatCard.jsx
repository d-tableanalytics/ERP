import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { fetchScoreSummary } from "../../store/slices/scoreSlice";

const StatCard = () => {
  const dispatch = useDispatch();

  const { summary, isSummaryLoading } = useSelector(
    (state) => state.score
  );

  useEffect(() => {
    dispatch(fetchScoreSummary());
  }, [dispatch]);

  if (isSummaryLoading) {
    return (
      <div className="p-6 text-center text-text-muted font-bold">
        Loading Score Summary...
      </div>
    );
  }

  if (!summary) return null;

  const { totalTasks, red, yellow, green } = summary;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      {/* 🔴 RED */}
      <ScoreBox
        title="Red Score"
        percent={red.percent}
        count={red.count}
        total={totalTasks}
        color="red"
        formula="(Tasks with Score = 2) ÷ Total Tasks × 100"
      />

      {/* 🟡 YELLOW */}
      <ScoreBox
        title="Yellow Score"
        percent={yellow.percent}
        count={yellow.count}
        total={totalTasks}
        color="yellow"
        formula="(Tasks with Score = 1) ÷ Total Tasks × 100"
      />

      {/* 🟢 GREEN */}
      <ScoreBox
        title="Green Score"
        percent={green.percent}
        count={green.count}
        total={totalTasks}
        color="green"
        formula='(Score = 0 AND Status = "Completed") ÷ Total Tasks × 100'
      />
    </div>
  );
};

export default StatCard;

/* ============================= */
/* ✅ Premium Score Box */
/* ============================= */
const ScoreBox = ({ title, percent, count, total, color, formula }) => {
  const theme = {
    red: {
      border: "border-red-500",
      text: "text-red-500",
      bg: "bg-red-500/5",
      icon: "error",
      pill: "bg-red-500/15 text-red-500",
    },
    yellow: {
      border: "border-yellow-500",
      text: "text-yellow-500",
      bg: "bg-yellow-500/5",
      icon: "warning",
      pill: "bg-yellow-500/15 text-yellow-500",
    },
    green: {
      border: "border-green-500",
      text: "text-green-500",
      bg: "bg-green-500/5",
      icon: "check_circle",
      pill: "bg-green-500/15 text-green-500",
    },
  };

  return (
    <div
      className={`relative rounded-2xl p-6 shadow-md border-l-4 ${theme[color].border} ${theme[color].bg}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 font-bold text-base text-text-main">
        <span
          className={`material-symbols-outlined ${theme[color].text}`}
        >
          {theme[color].icon}
        </span>
        {title}
      </div>

      {/* Percent */}
      <h2
        className={`text-5xl font-extrabold mt-4 tracking-tight ${theme[color].text}`}
      >
        {percent}%
      </h2>

      {/* Formula */}
      <div className="mt-6 text-xs text-text-muted leading-relaxed">
        <p className="font-bold text-text-main mb-2">Formula:</p>

        <span
          className={`inline-block px-3 py-1 rounded-lg font-semibold ${theme[color].pill}`}
        >
          {formula}
        </span>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-sm font-semibold text-text-main">
        <span className="text-text-muted">{count}</span>{" "}
        of{" "}
        <span className="text-text-muted">{total}</span>{" "}
        ={" "}
        <span className={`${theme[color].text} font-extrabold`}>
          {percent}%
        </span>
      </div>
    </div>
  );
};
