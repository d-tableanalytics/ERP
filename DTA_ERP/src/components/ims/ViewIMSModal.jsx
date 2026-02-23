import React from "react";
import { X, Eye } from "lucide-react";

const ViewIMSModal = ({ isOpen, onClose, transaction }) => {
  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-bg-card border border-border-main w-full max-w-7xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* ================= HEADER ================= */}
        <div className="px-8 py-5 border-b border-border-main flex justify-between items-center bg-bg-main/40">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-text-main">
                Transaction Details
              </h2>
              <p className="text-xs text-text-muted">
                Transaction ID: #{transaction.id}
              </p>
            </div>

            <span
              className={`px-4 py-1 rounded-full text-xs font-bold ${
                transaction.transaction_type === "IN"
                  ? "bg-green-500/10 text-green-600"
                  : "bg-red-500/10 text-red-600"
              }`}
            >
              {transaction.transaction_type}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-bg-main transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* ================= BODY ================= */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">

          {/* 🔹 Transaction Info Cards */}
          <div>
            <h3 className="text-sm font-bold text-primary mb-4">
              Transaction Information
            </h3>

            <div className="grid grid-cols-4 gap-5 text-sm">
              <InfoCard label="User ID" value={transaction.user_id} />
              <InfoCard label="Vendor Name" value={transaction.vendor_name} />
              <InfoCard label="Client Name" value={transaction.client_name} />
              <InfoCard label="Job No" value={transaction.job_no} />
              <InfoCard label="Invoice No" value={transaction.invoice_no} />

              <InfoCard
                label="Transaction Date"
                value={
                  transaction.transaction_date
                    ? new Date(
                        transaction.transaction_date
                      ).toLocaleString()
                    : "-"
                }
              />

              <InfoCard
                label="Created At"
                value={
                  transaction.created_at
                    ? new Date(transaction.created_at).toLocaleString()
                    : "-"
                }
              />
            </div>
          </div>

          {/* 🔹 Remarks */}
          <div>
            <h3 className="text-sm font-bold text-primary mb-3">
              Remarks
            </h3>
            <div className="bg-bg-main border border-border-main rounded-xl p-4 text-sm text-text-muted">
              {transaction.remarks || "No remarks provided"}
            </div>
          </div>

          {/* 🔥 ITEMS TABLE */}
          <div>
            <h3 className="text-sm font-bold text-primary mb-4">
              Transaction Items
            </h3>

            {transaction.items?.length > 0 ? (
              <div className="border border-border-main rounded-2xl overflow-hidden">

                <div className="overflow-auto max-h-[350px]">
                  <table className="w-full min-w-[1500px] text-xs">

                    <thead className="bg-bg-main sticky top-0 z-10">
                      <tr className="uppercase text-[10px] text-left">
                        <th className="px-3 py-3">ID</th>
                        <th>Txn ID</th>
                        <th>Product</th>
                         <th>Product Image</th>
                        <th>Description</th>
                        <th>MOC</th>
                        <th>Grade</th>
                        <th>Size1</th>
                        <th>Size2</th>
                        <th>Class</th>
                        <th>Sch2</th>
                        <th>Less Thk</th>
                        <th>Qty In</th>
                        <th>Qty Out</th>
                        <th>Unit</th>
                        <th>Location</th>
                        <th>Rack</th>
                        <th>Available</th>
                        <th>Created</th>
                      </tr>
                    </thead>

                    <tbody>
                      {transaction.items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-t border-border-main hover:bg-bg-main/40 transition"
                        >
                          <td className="px-3 py-3 font-medium">
                            {item.id}
                          </td>
                          <td>{item.transaction_id}</td>
                          <td className="font-semibold">
                            {item.product}
                          </td>
                          <td>
  {item?.product_url ? (
    <button
      onClick={() => window.open(item.product_url, "_blank")}
      className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 hover:bg-primary/20 transition"
      title="View Image"
    >
      <Eye size={16} className="text-primary" />
    </button>
  ) : (
    <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
      <span className="text-[10px] text-gray-500">N/A</span>
    </div>
  )}
</td>
                          <td>{item.description}</td>
                          <td>{item.moc}</td>
                          <td>{item.grade}</td>
                          <td>{item.size1}</td>
                          <td>{item.size2}</td>
                          <td>{item.class_sch}</td>
                          <td>{item.sch2}</td>
                          <td>{item.less_thk}</td>

                          <td className="text-green-600 font-bold">
                            {item.qty_in}
                          </td>

                          <td className="text-red-500 font-bold">
                            {item.qty_out}
                          </td>

                          <td>{item.unit}</td>
                          <td>{item.location}</td>
                          <td>{item.rack_no}</td>

                          <td className="font-bold text-primary">
                            {item.available_qty}
                          </td>

                          <td>
                            {item.created_at
                              ? new Date(
                                  item.created_at
                                ).toLocaleString()
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>

                  </table>
                </div>

              </div>
            ) : (
              <div className="text-text-muted text-sm">
                No items found
              </div>
            )}
          </div>

        </div>

        {/* ================= FOOTER ================= */}
        <div className="px-8 py-5 border-t border-border-main bg-bg-main/40">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold hover:opacity-90 transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

/* ================= INFO CARD ================= */
const InfoCard = ({ label, value }) => (
  <div className="bg-bg-main border border-border-main rounded-xl p-4">
    <p className="text-[10px] uppercase text-text-muted font-bold mb-1">
      {label}
    </p>
    <div className="text-sm font-semibold text-text-main">
      {value || "-"}
    </div>
  </div>
);

export default ViewIMSModal;