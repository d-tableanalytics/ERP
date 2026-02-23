import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import GRNPreviewModal from "../../components/common//GRNPreviewModal";
import toast from "react-hot-toast";
import {
  fetchMasters,
  createTransaction,
  editTransaction,
} from "../../store/slices/imsSlice";

const RequiredBadge = () => (
  <span className="ml-2 px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 text-xs font-bold uppercase">
    Required
  </span>
);

const SectionTitle = ({ title }) => (
  <div className="border-t border-border-main pt-6">
    <h3 className="text-sm font-bold text-text-main mb-4">{title}</h3>
  </div>
);

const Input = ({ label, required, ...props }) => (
  <div>
    <label className="flex items-center text-xs font-bold uppercase text-text-muted mb-1">
      {label} {required && <RequiredBadge />}
    </label>
    <input
      {...props}
      className="w-full bg-bg-main border border-border-main text-text-main rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
    />
  </div>
);

const Select = ({ label, required, children, ...props }) => (
  <div>
    <label className="flex items-center text-xs font-bold uppercase text-text-muted mb-1">
      {label} {required && <RequiredBadge />}
    </label>
    <select
      {...props}
      className="w-full bg-bg-main border border-border-main text-text-main rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
    >
      {children}
    </select>
  </div>
);

/* ================= COMPONENT ================= */

const emptyItem = {
  product: "",
  description: "",
  moc: "",
  grade: "",
  size1: "",
  size2: "",
  class_sch: "",
  sch2: "",
  less_thk: "",
  qty: "",
  unit: "",
  location: "",
  rack_no: "",
  additional_details: "",
   imageFile: null,
};

const CreateTransactionModal = ({
  isOpen,
  onClose,
  transactionToEdit,
  onSuccess,
}) => {
  const dispatch = useDispatch();
  const { masters, isSubmitting } = useSelector((state) => state.ims);
  const { user } = useSelector((state) => state.auth);
  const [showPreview, setShowPreview] = useState(false);
  const [formData, setFormData] = useState({
    transaction_type: "IN",
    vendor_name: "",
    client_name: "",
    job_no: "",
    invoice_no: "",
    transaction_date: "",
    remarks: "",
  });

  const [items, setItems] = useState([emptyItem]);

  useEffect(() => {
    if (isOpen) dispatch(fetchMasters());
  }, [isOpen, dispatch]);

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;

    if (field === "moc") updated[index].grade = "";
    if (field === "product") updated[index].description = "";

    setItems(updated);
  };

  useEffect(() => {
    if (transactionToEdit && isOpen) {
      setFormData({
        transaction_type: transactionToEdit.transaction_type || "IN",
        vendor_name: transactionToEdit.vendor_name || "",
        client_name: transactionToEdit.client_name || "",
        job_no: transactionToEdit.job_no || "",
        invoice_no: transactionToEdit.invoice_no || "",
        transaction_date:
          transactionToEdit.transaction_date?.split("T")[0] || "",
        remarks: transactionToEdit.remarks || "",
      });

      setItems(
        transactionToEdit.items?.length ? transactionToEdit.items : [emptyItem],
      );
    }
  }, [transactionToEdit, isOpen]);

  const addItem = () => setItems([...items, emptyItem]);
  const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!user?.id) {
      toast.error("User not found. Please login again.");
      return;
    }

    // Just open preview modal
    setShowPreview(true);
  };

 const handleFinalSubmit = async () => {
  const formDataToSend = new FormData();

  formDataToSend.append("user_id", user.id);
  formDataToSend.append("transaction_type", formData.transaction_type);
  formDataToSend.append("transaction_date", formData.transaction_date);
  formDataToSend.append(
    "vendor_name",
    formData.transaction_type === "IN" ? formData.vendor_name : ""
  );
  formDataToSend.append(
    "client_name",
    formData.transaction_type === "OUT" ? formData.client_name : ""
  );
  formDataToSend.append("job_no", formData.job_no);
  formDataToSend.append("invoice_no", formData.invoice_no);
  formDataToSend.append("remarks", formData.remarks);

  // Remove imageFile before sending items JSON
  const cleanItems = items.map(({ imageFile, ...rest }) => ({
    ...rest,
    qty: Number(rest.qty),
  }));

  formDataToSend.append("items", JSON.stringify(cleanItems));

  // Append images separately
  items.forEach((item, index) => {
    if (item.imageFile) {
      formDataToSend.append(`product_image_${index}`, item.imageFile);
    }
  });

  try {
    if (transactionToEdit) {
      await dispatch(
        editTransaction({
          id: transactionToEdit.id,
          updatedData: formDataToSend,
        })
      ).unwrap();
      toast.success("Transaction Updated");
    } else {
      await dispatch(createTransaction(formDataToSend)).unwrap();
      toast.success("Transaction Created");
    }

    setShowPreview(false);
    onSuccess();
    onClose();
  } catch (err) {
    toast.error("Something went wrong");
  }
};

  if (!isOpen) return null;

  const uniqueMOCs = [
    ...new Set(masters?.materials?.map((m) => m.category) || []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-bg-card border border-border-main w-full max-w-6xl rounded-2xl shadow-2xl flex flex-col max-h-[95vh]">
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-border-main flex justify-between items-center bg-bg-main">
          <h2 className="text-xl font-bold text-text-main">
            {transactionToEdit ? "Edit Transaction" : "New Transaction"}
          </h2>

          <select
            value={formData.transaction_type}
            onChange={(e) =>
              setFormData({
                ...formData,
                transaction_type: e.target.value,
              })
            }
            className="bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-lg font-semibold"
          >
            <option value="IN">IN (Purchase)</option>
            <option value="OUT">OUT (Dispatch)</option>
          </select>
        </div>

        {/* FORM */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-8"
        >
          {/* TOP SECTION */}
          <div className="grid md:grid-cols-4 gap-4">
            <Input
              label="Date"
              type="date"
              required
              value={formData.transaction_date}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  transaction_date: e.target.value,
                })
              }
            />

            {formData.transaction_type === "IN" ? (
              <Input
                label="Vendor Name"
                required
                value={formData.vendor_name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    vendor_name: e.target.value,
                  })
                }
              />
            ) : (
              <Input
                label="Client Name"
                required
                value={formData.client_name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    client_name: e.target.value,
                  })
                }
              />
            )}

            <Input
              label="Job No."
              required
              value={formData.job_no}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  job_no: e.target.value,
                })
              }
            />

            <Input
              label="Invoice No."
              required
              value={formData.invoice_no}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  invoice_no: e.target.value,
                })
              }
            />
          </div>

          {/* PRODUCT ITEMS */}
          {items.map((item, index) => (
            <div
              key={index}
              className="border border-border-main bg-bg-main p-4 rounded-xl space-y-6"
            >
              <SectionTitle title="Product Details" />

              <div className="grid md:grid-cols-5 lg:grid-cols-6 gap-4">
                <Select
                  label="Product"
                  required
                  value={item.product}
                  onChange={(e) =>
                    handleItemChange(index, "product", e.target.value)
                  }
                >
                  <option value="">Select Product</option>
                  {masters?.products?.map((p) => (
                    <option key={p.id} value={p.product_name}>
                      {p.product_name}
                    </option>
                  ))}
                </Select>

                <Select
                  label="Description"
                  value={item.description}
                  onChange={(e) =>
                    handleItemChange(index, "description", e.target.value)
                  }
                >
                  <option value="">Select Description</option>
                  {masters?.descriptions
                    ?.filter((d) => d.product_name === item.product)
                    .map((d) => (
                      <option key={d.id} value={d.description_name}>
                        {d.description_name}
                      </option>
                    ))}
                </Select>

                <Select
                  label="MOC"
                  value={item.moc}
                  onChange={(e) =>
                    handleItemChange(index, "moc", e.target.value)
                  }
                >
                  <option value="">Select MOC</option>
                  {uniqueMOCs.map((moc) => (
                    <option key={moc} value={moc}>
                      {moc}
                    </option>
                  ))}
                </Select>

                <Select
                  label="Grade"
                  value={item.grade}
                  onChange={(e) =>
                    handleItemChange(index, "grade", e.target.value)
                  }
                >
                  <option value="">Select Grade</option>
                  {masters?.grades
                    ?.filter((g) => g.material_type === item.moc)
                    .map((g) => (
                      <option key={g.id} value={g.grade_name}>
                        {g.grade_name}
                      </option>
                    ))}
                </Select>

                <Select
                  label="Size 1"
                  value={item.size1}
                  onChange={(e) =>
                    handleItemChange(index, "size1", e.target.value)
                  }
                >
                  <option value="">Select Size 1</option>
                  {masters?.size1?.map((s) => (
                    <option key={s.id} value={s.size_value}>
                      {s.size_value}
                    </option>
                  ))}
                </Select>

                <Select
                  label="Size 2"
                  value={item.size2}
                  onChange={(e) =>
                    handleItemChange(index, "size2", e.target.value)
                  }
                >
                  <option value="">Select Size 2</option>
                  {masters?.size2?.map((s) => (
                    <option key={s.id} value={s.size_value}>
                      {s.size_value}
                    </option>
                  ))}
                </Select>

                <Select
                  label="Unit"
                  required
                  value={item.unit}
                  onChange={(e) =>
                    handleItemChange(index, "unit", e.target.value)
                  }
                >
                  {" "}
                  <option value="">Select Unit</option>{" "}
                  {masters?.units?.map((u) => (
                    <option key={u.id} value={u.unit_name}>
                      {u.unit_name}
                    </option>
                  ))}{" "}
                </Select>

                <Input
                  label="Less Thk."
                  value={item.less_thk}
                  onChange={(e) =>
                    handleItemChange(index, "less_thk", e.target.value)
                  }
                />

                <Input
                  label={
                    formData.transaction_type === "IN" ? "Qty In" : "Qty Out"
                  }
                  type="number"
                  required
                  value={item.qty}
                  onChange={(e) =>
                    handleItemChange(index, "qty", e.target.value)
                  }
                />

                <Select
                  label="Class / Sch."
                  value={item.class_sch}
                  onChange={(e) =>
                    handleItemChange(index, "class_sch", e.target.value)
                  }
                >
                  <option value="">Select</option>
                  {masters?.class_sch
                    ?.filter((c) => c.product_name === item.product)
                    .map((c) => (
                      <option key={c.id} value={c.class_value}>
                        {c.class_value}
                      </option>
                    ))}
                </Select>

                <Select
                  label="Sch. 2"
                  value={item.sch2}
                  onChange={(e) =>
                    handleItemChange(index, "sch2", e.target.value)
                  }
                >
                  <option value="">Select Sch. 2</option>
                  {masters?.sch2?.map((s) => (
                    <option key={s.id} value={s.sch_value}>
                      {s.sch_value}
                    </option>
                  ))}
                </Select>
                <div className="mb-4">
  <label className="flex items-center text-xs font-bold uppercase text-text-muted mb-1">
    Product Image
  </label>
  <input
    type="file"
    accept="image/*"
    onChange={(e) =>
      handleItemChange(index, "imageFile", e.target.files[0])
    }
    className="w-full bg-bg-main border border-border-main text-text-main rounded-lg px-3 py-2 text-sm"
  />
</div>
              </div>

              <SectionTitle title="Additional Information" />

              <div className="grid md:grid-cols-4 gap-4">
                <Select
                  label="Add. Details"
                  value={item.additional_details}
                  onChange={(e) =>
                    handleItemChange(
                      index,
                      "additional_details",
                      e.target.value,
                    )
                  }
                >
                  <option value="">Select Additional Details</option>
                  {masters?.additional_details?.map((d) => (
                    <option key={d.id} value={d.detail_name}>
                      {d.detail_name}
                    </option>
                  ))}
                </Select>

                <Input
                  label="Remarks"
                  value={formData.remarks}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      remarks: e.target.value,
                    })
                  }
                />

                <Select
                  label="Location"
                  value={item.location}
                  onChange={(e) =>
                    handleItemChange(index, "location", e.target.value)
                  }
                >
                  <option value="">Select Location</option>
                  {masters?.locations?.map((l) => (
                    <option key={l.id} value={l.location_name}>
                      {l.location_name}
                    </option>
                  ))}
                </Select>

                <Input
                  label="Rack No."
                  value={item.rack_no}
                  onChange={(e) =>
                    handleItemChange(index, "rack_no", e.target.value)
                  }
                />
              </div>

              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-red-500 text-sm font-semibold"
                >
                  Remove Item
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addItem}
            className="text-primary font-semibold"
          >
            + Add Product
          </button>

          {/* FOOTER */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-border-main py-3 rounded-xl text-text-main"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold"
            >
              {isSubmitting ? "Saving..." : "Save Transaction"}
            </button>
          </div>
        </form>
      </div>
      <GRNPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onConfirm={handleFinalSubmit}
        formData={formData}
        items={items}
      />
    </div>
  );
};

export default CreateTransactionModal;
