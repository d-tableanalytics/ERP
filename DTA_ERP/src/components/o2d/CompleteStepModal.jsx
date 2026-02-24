import React, { useState, useEffect } from "react";
import { CheckCircle2 } from "lucide-react";

const CompleteStepModal = ({ isOpen, onClose, onComplete }) => {
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (isOpen) {
      setRemarks("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isDisabled = !remarks.trim();

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">

      {/* Modal Card */}
      <div className="bg-bg-card border border-border-main rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-border-main flex items-center gap-3">
          <div className="size-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
            <CheckCircle2 size={20} />
          </div>

          <div>
            <h2 className="text-lg font-bold text-text-main">
              Complete Step
            </h2>
            <p className="text-xs text-text-muted">
              Add final remarks before closing this step
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="text-[11px] uppercase font-bold text-text-muted tracking-wide">
              Remarks
            </label>

            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter remarks..."
              rows={4}
              className="mt-2 w-full bg-bg-main border border-border-main rounded-2xl px-4 py-3 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-green-500 resize-none transition"
            />
          </div>

          <div className="text-right text-xs text-text-muted">
            {remarks.length} characters
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-main flex justify-end gap-3 bg-bg-main/30">

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-2xl bg-bg-main text-text-main font-semibold hover:opacity-80 transition"
          >
            Cancel
          </button>

          <button
            disabled={isDisabled}
            onClick={() => onComplete(remarks)}
            className={`px-5 py-2 rounded-2xl font-semibold text-white transition ${
              isDisabled
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:scale-[1.02] active:scale-95"
            }`}
          >
            Complete Step
          </button>
        </div>

      </div>
    </div>
  );
};

export default CompleteStepModal;