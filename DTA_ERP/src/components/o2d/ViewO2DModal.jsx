import React from "react";

const ViewO2DModal = ({ isOpen, onClose, o2d ,getEmployeeName}) => {
  if (!isOpen || !o2d) return null;

  const formatDateTime = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("en-IN");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-bg-card border border-border-main w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-border-main flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-text-main">
              O2D Order Details
            </h2>
            <p className="text-[11px] uppercase text-text-muted font-bold tracking-widest">
              {o2d.customer_type} • {o2d.party_name}
            </p>
          </div>

          <button
            onClick={onClose}
            className="size-9 rounded-full hover:bg-bg-main flex items-center justify-center text-text-muted"
          >
            ✖
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Info label="Party Name" value={o2d.party_name} />
            <Info label="Customer Type" value={o2d.customer_type} />
            <Info label="Contact No" value={o2d.contact_no} />
            <Info label="Alternate No" value={o2d.alternate_no} />
            <Info label="Email" value={o2d.email} />
            <Info label="Location" value={o2d.location} />
            <Info label="State" value={o2d.state} />
            <Info label="Representative" value={o2d.representative} />
          </div>

          {/* Items Section */}
          <div className="border border-border-main rounded-xl p-4">
            <h3 className="font-bold text-primary text-sm mb-3">
              Items
            </h3>

            {o2d.items?.length > 0 ? (
              <div className="space-y-2">
                {o2d.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex justify-between bg-bg-main rounded-lg px-3 py-2 text-sm"
                  >
                    <span className="font-semibold">
                      {item.item_name}
                    </span>
                    <span className="text-text-muted">
                      Qty: {item.qty}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-muted text-sm">No Items</p>
            )}
          </div>

          {/* Steps Section */}
          <div className="border border-border-main rounded-xl p-4">
            <h3 className="font-bold text-primary text-sm mb-3">
              Workflow Steps
            </h3>

            {o2d.steps?.length > 0 ? (
              <div className="space-y-3">
                {o2d.steps.map((step, i) => (
                  <div
                    key={i}
                    className="bg-bg-main rounded-xl p-3 border border-border-main"
                  >
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-sm">
                        {step.step_name}
                      </h4>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-bold">
                        Group {step.dependency_group}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
                      <Info
                        label="Assigned To"
                        value={
                          step.employee_name ||
                          `Employee : ${getEmployeeName(step.assigned_to)}`
                        }
                      />
                      <Info
                        label="Planned Date"
                        value={formatDateTime(step.planned_date)}
                      />
                      <Info
                        label="Status"
                        value={step.status || "Pending"}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-muted text-sm">
                No Steps Created
              </p>
            )}
          </div>

          {/* Created At */}
          <div className="border border-border-main rounded-xl p-4">
            <Info
              label="Created At"
              value={formatDateTime(o2d.created_at)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-main">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold shadow-md hover:opacity-90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/* Reusable Info */
const Info = ({ label, value }) => (
  <div>
    <p className="text-[11px] uppercase text-text-muted font-bold">
      {label}
    </p>
    <p className="text-sm font-semibold text-text-main break-words">
      {value || "-"}
    </p>
  </div>
);

export default ViewO2DModal;