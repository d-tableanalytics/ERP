import React, { useState, useEffect } from "react";

const AssignStepModal = ({ isOpen, onClose, employees = [], onAssign }) => {
  const [selected, setSelected] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSelected("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50    bg-black/60 backdrop-blur-sm  flex justify-center items-center p-4">
      <div className="bg-bg-card border border-border-main rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="px-6 py-4 border-b border-border-main flex justify-between items-center">
          <h2 className="text-lg font-bold text-text-main">
            Assign Step
          </h2>

          <button
            onClick={onClose}
            className="text-text-muted hover:text-red-500"
          >
            ✖
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <label className="text-xs uppercase font-bold text-text-muted">
            Select Employee
          </label>

          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="mt-2 w-full bg-bg-main border border-border-main rounded-xl px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select Employee</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.First_Name} {emp.Last_Name}
              </option>
            ))}
          </select>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-main flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-bg-main text-text-main font-semibold hover:opacity-80"
          >
            Cancel
          </button>

          <button
            disabled={!selected}
            onClick={() => onAssign(Number(selected))}
            className={`px-4 py-2 rounded-xl font-semibold text-white ${
              selected
                ? "bg-primary hover:opacity-90"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            Assign
          </button>
        </div>

      </div>
    </div>
  );
};

export default AssignStepModal;