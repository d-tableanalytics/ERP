import { useState } from "react";

const SelectField = ({ label, value, onChange }) => {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Select</option>
        <option value="OKAY">OKAY</option>
        <option value="NOT OKAY">NOT OKAY</option>
      </select>
    </div>
  );
};

const POCheckModal = ({ isOpen, onClose, poNumber }) => {
  const [form, setForm] = useState({
    status: "",
    inspection: "OKAY",
    documentation: "OKAY",
    deliveryDateCheck: "OKAY",
    gst: "OKAY",
    hsn: "OKAY",
    qty: "OKAY",
    rateAmount: "OKAY",
    itemDescription: "OKAY",
    poAmendment: "",
  });

  if (!isOpen) return null;

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    console.log("PO Check Submitted:", form);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
      <div className="bg-white w-[500px] rounded-lg shadow-lg overflow-hidden">

        {/* Header */}
        <div className="bg-blue-600 text-white px-4 py-3 flex justify-between items-center">
          <h2 className="font-semibold">
            P.O CHECK - {poNumber}
          </h2>
          <button onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">

          <SelectField
            label="Status"
            value={form.status}
            onChange={(val) => handleChange("status", val)}
          />

          <SelectField
            label="Inspection"
            value={form.inspection}
            onChange={(val) => handleChange("inspection", val)}
          />

          <SelectField
            label="Documentation"
            value={form.documentation}
            onChange={(val) => handleChange("documentation", val)}
          />

          <SelectField
            label="Delivery Date Check"
            value={form.deliveryDateCheck}
            onChange={(val) => handleChange("deliveryDateCheck", val)}
          />

          <SelectField
            label="GST"
            value={form.gst}
            onChange={(val) => handleChange("gst", val)}
          />

          <SelectField
            label="HSN"
            value={form.hsn}
            onChange={(val) => handleChange("hsn", val)}
          />

          <SelectField
            label="Qty"
            value={form.qty}
            onChange={(val) => handleChange("qty", val)}
          />

          <SelectField
            label="Rate Amount"
            value={form.rateAmount}
            onChange={(val) => handleChange("rateAmount", val)}
          />

          <SelectField
            label="Item Description"
            value={form.itemDescription}
            onChange={(val) => handleChange("itemDescription", val)}
          />

          <SelectField
            label="PO Amendment Required"
            value={form.poAmendment}
            onChange={(val) => handleChange("poAmendment", val)}
          />

          <button
            onClick={handleSubmit}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

export default POCheckModal;