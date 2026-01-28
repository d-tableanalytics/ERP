import React, { useEffect } from "react";
import { X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { getHelpTicketHistoryById } from "../../store/slices/masterSlice";

const HelpTicketHistoryModal = ({ ticketId, onClose }) => {
  const dispatch = useDispatch();

  const { helpTicketHistory, isLoading } = useSelector(
    (state) => state.master
  );

  useEffect(() => {
    if (ticketId) {
      dispatch(getHelpTicketHistoryById(ticketId));
    }
  }, [ticketId, dispatch]);

  if (!ticketId) return null;
  if (!helpTicketHistory) return null;

  // latest history record
  const history = helpTicketHistory?.data?.[0];
  if (!history) return null;

  const {
    ticket_no,
    action_type,
    stage,
    action_date,
    action_by,
    remarks,
    new_values,
  } = history;

  const formatDate = (date) =>
    date ? new Date(date).toLocaleString() : "-";

  /* ---------------- UI COMPONENT ---------------- */
  const ChangeRow = ({ label, newVal }) => {
    if (!newVal) return null;

    return (
      <div className="flex justify-between items-center bg-bg-main/60 px-3 py-2 rounded-lg">
        <span className="text-xs font-semibold text-text-muted">
          {label}
        </span>
        <span className="text-xs font-bold text-emerald-600">
          {newVal}
        </span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bg-card border border-border-main w-full max-w-3xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* ================= HEADER ================= */}
        <div className="p-5 border-b border-border-main flex justify-between items-start">
          <div>
            <h2 className="text-lg font-bold text-text-main">
              Ticket History
            </h2>

            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold text-text-muted">
                {ticket_no}
              </span>

              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase">
                {action_type?.replaceAll("_", " ")}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-main"
          >
            <X size={18} />
          </button>
        </div>

        {/* ================= BODY ================= */}
        <div className="p-6 space-y-6">

          {/* LOADING */}
          {isLoading && (
            <p className="text-sm text-text-muted text-center">
              Loading history...
            </p>
          )}

          {/* META INFO */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              ["Action Type", action_type],
              ["Stage", `Stage ${stage}`],
              ["Action By (ID)", action_by],
              ["Action Date", formatDate(action_date)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="bg-bg-main/40 p-3 rounded-lg"
              >
                <label className="text-[10px] font-bold uppercase text-text-muted">
                  {label}
                </label>
                <p className="text-xs font-bold text-text-main mt-1">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* REMARKS */}
          {remarks && (
            <div className="bg-bg-main/40 p-4 rounded-lg">
              <label className="text-[10px] font-bold uppercase text-text-muted">
                Remarks
              </label>
              <p className="text-sm text-text-main mt-1">
                {remarks}
              </p>
            </div>
          )}

          {/* NEW VALUES */}
          <div className="border-t border-border-main pt-4 space-y-3">
            <h3 className="text-sm font-bold text-primary">
              Updated Values
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ChangeRow label="Status" newVal={new_values?.status} />
              <ChangeRow label="Current Stage" newVal={new_values?.current_stage} />
              <ChangeRow
                label="Reraise Date"
                newVal={new_values?.reraise_date?.split("T")[0]}
              />
              <ChangeRow
                label="Solver Planned Date"
                newVal={new_values?.solver_planned_date?.split("T")[0]}
              />
              <ChangeRow
                label="PC Planned Date"
                newVal={new_values?.pc_planned_date?.split("T")[0]}
              />
              <ChangeRow label="Priority" newVal={new_values?.priority} />
              <ChangeRow label="Location" newVal={new_values?.location} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpTicketHistoryModal;
