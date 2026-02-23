import { useState } from "react";
import ViewIMSModal from "../../components/ims/ViewIMSModal";

const IMSCard = ({ transaction, onEdit }) => {
  const [viewTransaction, setViewTransaction] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const totalQtyIn = transaction.items?.reduce(
    (sum, item) => sum + Number(item.qty_in || 0),
    0
  );

  const totalQtyOut = transaction.items?.reduce(
    (sum, item) => sum + Number(item.qty_out || 0),
    0
  );

  const isIN = transaction.transaction_type === "IN";

  return (
    <div className="bg-bg-card rounded-2xl border border-border-main shadow-lg hover:border-primary/50 transition-all relative overflow-hidden">

      {/* HEADER */}
      <div className="p-4 flex justify-between">

        <div className="flex-1 pr-16">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-text-muted">
              #{transaction.id}
            </span>

            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isIN
                  ? "bg-green-500/10 text-green-600"
                  : "bg-red-500/10 text-red-600"
              }`}
            >
              {transaction.transaction_type}
            </span>
          </div>

          <h3 className="font-bold text-text-main text-base truncate">
            {transaction.client_name ||
              transaction.vendor_name ||
              "No Party"}
          </h3>

          <p className="text-xs text-text-muted mt-1">
            Job No: {transaction.job_no || "-"}
          </p>

          <p className="text-xs text-text-muted">
            Invoice: {transaction.invoice_no || "-"}
          </p>
        </div>

        {/* ACTIONS */}
        <div className="absolute top-4 right-4 flex gap-1 bg-bg-card/80 backdrop-blur-sm rounded-lg p-1 border border-border-main shadow-sm">

          <button
            onClick={() => {
              setViewTransaction(transaction);
              setIsViewModalOpen(true);
            }}
            className="p-1 text-text-muted hover:text-primary"
            title="View"
          >
            <span className="material-symbols-outlined text-xl">
              visibility
            </span>
          </button>

          <button
            onClick={() => onEdit(transaction)}
            className="p-1 text-text-muted hover:text-amber-500"
            title="Edit"
          >
            <span className="material-symbols-outlined text-xl">
              edit
            </span>
          </button>
        </div>
      </div>

      {/* BODY INFO GRID */}
      <div className="grid grid-cols-2 gap-3 px-4 pb-4">

        <InfoBlock
          icon="calendar_today"
          label="Date"
          value={formatDate(transaction.transaction_date)}
          color="blue"
        />

        <InfoBlock
          icon="inventory_2"
          label="Items"
          value={`${transaction.items?.length || 0} Products`}
          color="purple"
        />

        <InfoBlock
          icon="south"
          label="Qty IN"
          value={totalQtyIn}
          color="green"
        />

        <InfoBlock
          icon="north"
          label="Qty OUT"
          value={totalQtyOut}
          color="red"
        />
      </div>

      {/* FOOTER */}
      <div className="bg-bg-main/40 px-4 py-3 border-t border-border-main text-xs">
        <p className="text-[10px] uppercase font-bold text-text-muted">
          Remarks
        </p>
        <p className="font-semibold text-text-main truncate">
          {transaction.remarks || "No Remarks"}
        </p>
      </div>

      {/* VIEW MODAL */}
      <ViewIMSModal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        transaction={viewTransaction}
      />
    </div>
  );
};

export default IMSCard;

/* Reusable Block */
const InfoBlock = ({ icon, label, value, color }) => {
  return (
    <div className="bg-bg-main rounded-xl p-3 flex items-center gap-3 border border-border-main">
      <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
        <span className="material-symbols-outlined text-lg">{icon}</span>
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase text-text-muted">
          {label}
        </p>
        <p className="text-text-main font-bold text-sm truncate">
          {value}
        </p>
      </div>
    </div>
  );
};