import React from "react";
import { AlertTriangle, X } from "lucide-react";

const DeleteModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-card border border-border-main w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-start p-4 bg-bg-main/20">
          <div className="p-3 rounded-xl bg-red-500/10 text-red-500">
            <AlertTriangle size={24} />
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-main text-text-muted transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 text-center">
          <h3 className="text-xl font-bold text-text-main mb-2">
            {title || "Delete Confirmation"}
          </h3>
          <p className="text-text-muted text-sm leading-relaxed">
            {message ||
              "Are you sure you want to delete this item? This action cannot be undone."}
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 bg-bg-main/10 border-t border-border-main">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border-main text-sm font-semibold text-text-main hover:bg-bg-main transition"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 shadow-lg shadow-red-500/20 transition active:scale-95"
          >
            Delete Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;
