import React, { useState } from "react";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";
import { createO2DOrder } from "../../store/slices/o2dSlice";

/* ================= Small Input ================= */
const Input = ({ label, ...props }) => (
  <div>
    <label className="text-[11px] font-bold uppercase text-text-muted">
      {label}
    </label>
    <input
      {...props}
      className="w-full mt-1 bg-bg-main border border-border-main rounded-xl px-3 py-2 text-sm"
    />
  </div>
);

/* ================= Small Select (ADDED) ================= */
const Select = ({ label, children, ...props }) => (
  <div>
    <label className="text-[11px] font-bold uppercase text-text-muted">
      {label}
    </label>
    <select
      {...props}
      className="w-full mt-1 bg-bg-main border border-border-main rounded-xl px-3 py-2 text-sm"
    >
      {children}
    </select>
  </div>
);

const CreateO2DModal = ({ isOpen, onClose, onSuccess }) => {
  const dispatch = useDispatch();

  const customerTypes = ["Retail", "Wholesale", "Corporate"];

  const [formData, setFormData] = useState({
    party_name: "",
    customer_type: "",
    contact_no: "",
    alternate_no: "",
    email: "",
    location: "",
    state: "",
    representative: "",
    items: [{ item_name: "", qty: "" }],
  });

  /* ================= Add Item ================= */
  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { item_name: "", qty: "" }],
    }));
  };

  /* ================= Remove Item ================= */
  const removeItem = (index) => {
    const updated = [...formData.items];
    updated.splice(index, 1);
    setFormData({ ...formData, items: updated });
  };

  /* ================= Submit ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();

    const filteredItems = formData.items
      .filter((item) => item.item_name && item.qty)
      .map((item) => ({
        item_name: item.item_name,
        qty: Number(item.qty),
      }));

    const payload = {
      ...formData,
      items: filteredItems,
    };

    try {
      await dispatch(createO2DOrder(payload)).unwrap();
      toast.success("O2D Order Created Successfully");
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error("Something went wrong");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/70 p-4">
      <div className="bg-bg-card w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden">

        {/* ================= Header ================= */}
        <div className="px-8 py-5 border-b flex justify-between items-center">
          <h2 className="text-xl font-extrabold">Create O2D Order</h2>
          <button onClick={onClose}>✖</button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-8 space-y-8 max-h-[80vh] overflow-y-auto"
        >
          {/* ================= Basic Info ================= */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Input
              label="Party Name"
              required
              value={formData.party_name}
              onChange={(e) =>
                setFormData({ ...formData, party_name: e.target.value })
              }
            />

            <Select
              label="Customer Type"
              value={formData.customer_type}
              onChange={(e) =>
                setFormData({ ...formData, customer_type: e.target.value })
              }
            >
              <option value="">Select Type</option>
              {customerTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>

            <Input
              label="Contact No"
              value={formData.contact_no}
              onChange={(e) =>
                setFormData({ ...formData, contact_no: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Input
              label="Alternate No"
              value={formData.alternate_no}
              onChange={(e) =>
                setFormData({ ...formData, alternate_no: e.target.value })
              }
            />

            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />

            <Input
              label="Location"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input
              label="State"
              value={formData.state}
              onChange={(e) =>
                setFormData({ ...formData, state: e.target.value })
              }
            />

            <Input
              label="Representative"
              value={formData.representative}
              onChange={(e) =>
                setFormData({ ...formData, representative: e.target.value })
              }
            />
          </div>

          {/* ================= Items ================= */}
          <div>
            <h3 className="font-bold mb-3">Items</h3>

            {formData.items.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-2 gap-3 mb-3 items-end"
              >
                <Input
                  label="Item Name"
                  value={item.item_name}
                  onChange={(e) => {
                    const updated = [...formData.items];
                    updated[index].item_name = e.target.value;
                    setFormData({ ...formData, items: updated });
                  }}
                />

                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      label="Qty"
                      type="number"
                      value={item.qty}
                      onChange={(e) => {
                        const updated = [...formData.items];
                        updated[index].qty = e.target.value;
                        setFormData({ ...formData, items: updated });
                      }}
                    />
                  </div>

                  {formData.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="px-3 py-2 bg-red-500 text-white rounded-xl mt-6"
                    >
                      ✖
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addItem}
              className="text-primary font-bold"
            >
              + Add Item
            </button>
          </div>

          {/* ================= Footer ================= */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl bg-primary text-white font-bold"
            >
              Create O2D Order
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-bg-main font-bold"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateO2DModal;