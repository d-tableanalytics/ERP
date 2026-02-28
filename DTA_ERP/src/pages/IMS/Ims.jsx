import React, { useState, useEffect, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Eye, Pencil, Trash, LayoutGrid, List, Plus } from "lucide-react";
import AutoSuggestInput from "../../components/common/AutoSuggestInput";
import MainLayout from "../../components/layout/MainLayout";
import CreateIMSModal from "../../components/ims/CreateIMSModal";
import IMSCard from "../../components/ims/IMSCard";
import Loader from "../../components/common/Loader";
import ViewIMSModal from "../../components/ims/ViewIMSModal";

import {
  fetchTransactions,
  deleteTransaction,
} from "../../store/slices/imsSlice";

const IMS = () => {
  const dispatch = useDispatch();
  const { transactions = [], isLoading } = useSelector((state) => state.ims);

  /* ================= UI STATES ================= */

  const [filterType, setFilterType] = useState("ALL");
  const [viewMode, setViewMode] = useState("list");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState(null);
  const [viewTransaction, setViewTransaction] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [productFilter, setProductFilter] = useState("");
  const [descriptionFilter, setDescriptionFilter] = useState("");
  const [mocFilter, setMocFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [size1Filter, setSize1Filter] = useState("");
  const [size2Filter, setSize2Filter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [sch2Filter, setSch2Filter] = useState("");
  const [partyFilter, setPartyFilter] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  /* ================= FETCH ================= */
  useEffect(() => {
    dispatch(fetchTransactions());
  }, [dispatch]);

  /* ================= SAFE FIX HERE ================= */
  const allItems = (transactions || [])
    .flatMap((t) => t?.items || [])
    .filter((item) => item && typeof item === "object");

  const productOptions = [
    ...new Set(allItems.map((i) => i.product).filter(Boolean)),
  ];
  const descriptionOptions = [
    ...new Set(allItems.map((i) => i.description).filter(Boolean)),
  ];
  const mocOptions = [...new Set(allItems.map((i) => i.moc).filter(Boolean))];
  const gradeOptions = [
    ...new Set(allItems.map((i) => i.grade).filter(Boolean)),
  ];
  const size1Options = [
    ...new Set(allItems.map((i) => i.size1).filter(Boolean)),
  ];
  const size2Options = [
    ...new Set(allItems.map((i) => i.size2).filter(Boolean)),
  ];
  const classOptions = [
    ...new Set(allItems.map((i) => i.class_sch).filter(Boolean)),
  ];
  const sch2Options = [...new Set(allItems.map((i) => i.sch2).filter(Boolean))];

  const partyOptions = [
    ...new Set(
      (transactions || [])
        .map((t) => t?.vendor_name || t?.client_name)
        .filter(Boolean),
    ),
  ];

  /* ================= FILTERING ================= */
  const filteredTransactions = useMemo(() => {
    let data = [...transactions];

 

    if (filterType !== "ALL") {
      data = data.filter((t) => t.transaction_type === filterType);
    }

    data = data.filter((txn) => {
      if (!txn.items || txn.items.length === 0) return true;

      return txn.items.some((item) => {
        if (!item) return false;

        return (
          (!productFilter ||
            item.product
              ?.toLowerCase()
              .includes(productFilter.toLowerCase())) &&
          (!descriptionFilter ||
            item.description
              ?.toLowerCase()
              .includes(descriptionFilter.toLowerCase())) &&
          (!mocFilter ||
            item.moc?.toLowerCase().includes(mocFilter.toLowerCase())) &&
          (!gradeFilter ||
            item.grade?.toLowerCase().includes(gradeFilter.toLowerCase())) &&
          (!size1Filter || item.size1?.toString().includes(size1Filter)) &&
          (!size2Filter || item.size2?.toString().includes(size2Filter)) &&
          (!classFilter ||
            item.class_sch
              ?.toLowerCase()
              .includes(classFilter.toLowerCase())) &&
          (!sch2Filter ||
            item.sch2?.toLowerCase().includes(sch2Filter.toLowerCase())) &&
          (!partyFilter ||
            txn.vendor_name
              ?.toLowerCase()
              .includes(partyFilter.toLowerCase()) ||
            txn.client_name?.toLowerCase().includes(partyFilter.toLowerCase()))
        );
      });
    });

    return data;
  }, [
    transactions,

    filterType,
    productFilter,
    descriptionFilter,
    mocFilter,
    gradeFilter,
    size1Filter,
    size2Filter,
    classFilter,
    sch2Filter,
    partyFilter,
  ]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [
    
    filterType,
    productFilter,
    descriptionFilter,
    mocFilter,
    gradeFilter,
    size1Filter,
    size2Filter,
    classFilter,
    sch2Filter,
    partyFilter,
  ]);

  const handleDelete = (id) => {
    if (window.confirm("Delete this transaction?")) {
      dispatch(deleteTransaction(id));
    }
  };

  return (
    <MainLayout title="IMS Management">
      <div className="flex flex-col gap-6 p-6">
        <div className="bg-bg-card border border-border-main rounded-2xl p-5 shadow-sm">
          {/* Top Row */}
          <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
            {/* View Toggle */}
            <div className="flex bg-bg-main border border-border-main rounded-lg p-1">
              <ToggleButton
                active={viewMode === "list"}
                onClick={() => setViewMode("list")}
                icon={<List size={16} />}
              />
              <ToggleButton
                active={viewMode === "card"}
                onClick={() => setViewMode("card")}
                icon={<LayoutGrid size={16} />}
              />
            </div>

            {/* Create Button */}
            <button
              onClick={() => {
                setTransactionToEdit(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2 rounded-xl font-semibold hover:opacity-90 transition"
            >
              <Plus size={16} />
              Create Transaction
            </button>
          </div>

          {/* Filters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <AutoSuggestInput
              placeholder="Select Product"
              value={productFilter}
              onChange={setProductFilter}
              suggestions={productOptions}
            />

            <AutoSuggestInput
              placeholder="Select Description"
              value={descriptionFilter}
              onChange={setDescriptionFilter}
              suggestions={descriptionOptions}
            />

            <AutoSuggestInput
              placeholder="Select MOC"
              value={mocFilter}
              onChange={setMocFilter}
              suggestions={mocOptions}
            />

            <AutoSuggestInput
              placeholder="Select Grade"
              value={gradeFilter}
              onChange={setGradeFilter}
              suggestions={gradeOptions}
            />

            <AutoSuggestInput
              placeholder="Size 1"
              value={size1Filter}
              onChange={setSize1Filter}
              suggestions={size1Options}
            />

            <AutoSuggestInput
              placeholder="Size 2"
              value={size2Filter}
              onChange={setSize2Filter}
              suggestions={size2Options}
            />

            <AutoSuggestInput
              placeholder="Select Class"
              value={classFilter}
              onChange={setClassFilter}
              suggestions={classOptions}
            />

            <AutoSuggestInput
              placeholder="Sch 2"
              value={sch2Filter}
              onChange={setSch2Filter}
              suggestions={sch2Options}
            />

            <AutoSuggestInput
              placeholder="Search Party..."
              value={partyFilter}
              onChange={setPartyFilter}
              suggestions={partyOptions}
            />

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-bg-main border border-border-main rounded-lg px-3 py-2 text-sm outline-none"
            >
              <option value="ALL">All</option>
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
            </select>
          </div>
        </div>

        {/* ================= CONTENT ================= */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12">
            <Loader className="w-48 h-48" />
            <p className="mt-2 text-text-muted font-bold text-sm">
              Loading ims...
            </p>
          </div>
        ) : paginatedTransactions.length === 0 ? (
          <EmptyState />
        ) : viewMode === "list" ? (
          <TableView
            data={paginatedTransactions}
            onView={(txn) => {
              setViewTransaction(txn);
              setIsViewModalOpen(true);
            }}
            onEdit={(txn) => {
              setTransactionToEdit(txn);
              setIsModalOpen(true);
            }}
            onDelete={handleDelete}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {paginatedTransactions.map((txn) => (
              <IMSCard
                key={txn.id}
                transaction={txn}
                onView={() => {
                  setViewTransaction(txn);
                  setIsViewModalOpen(true);
                }}
                onEdit={() => {
                  setTransactionToEdit(txn);
                  setIsModalOpen(true);
                }}
                onDelete={() => handleDelete(txn.id)}
              />
            ))}
          </div>
        )}

        {/* ================= PAGINATION ================= */}
        {filteredTransactions.length > 0 && (
          <div
            className="flex justify-between items-center 
                 bg-bg-main border border-border-main
                  rounded-2xl px-6 py-3 text-sm shadow-inner"
          >
            {/* Left Side */}
            <span className="text-text-muted font-medium">
              Showing{" "}
              <span className="text-text-main font-semibold">
                {(currentPage - 1) * itemsPerPage + 1}
              </span>
              –
              <span className="text-text-main font-semibold">
                {Math.min(
                  currentPage * itemsPerPage,
                  filteredTransactions.length,
                )}
              </span>{" "}
              of{" "}
              <span className="text-text-main font-semibold">
                {filteredTransactions.length}
              </span>
            </span>

            {/* Right Side Buttons */}
            <div className="flex gap-3">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="px-4 py-2 bg-bg-main border border-border-main rounded-lg text-sm font-medium text-text-main disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 hover:text-white transition-colors"
              >
                Previous
              </button>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="px-4 py-2 bg-bg-main border border-border-main rounded-lg text-sm font-medium text-text-main disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 hover:text-white transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ================= MODALS ================= */}
        <ViewIMSModal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          transaction={viewTransaction}
        />

        <CreateIMSModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          transactionToEdit={transactionToEdit}
          onSuccess={() => dispatch(fetchTransactions())}
        />
      </div>
    </MainLayout>
  );
};

/* ================= REUSABLE UI COMPONENTS ================= */

const ToggleButton = ({ active, onClick, icon }) => (
  <button
    onClick={onClick}
    className={`p-2 rounded-md transition ${
      active ? "bg-primary text-white" : "text-gray-600"
    }`}
  >
    {icon}
  </button>
);

const EmptyState = () => (
  <div className="bg-bg-card border border-border-main rounded-2xl p-3 text-center text-text-muted">
    No Transactions Found
  </div>
);

const TableView = ({ data, onView, onEdit, onDelete }) => {
  // Flatten transactions to individual item rows
  const flatData = data.flatMap((txn) => {
    if (!txn.items || txn.items.length === 0) {
      return [
        {
          id: null,
          isPlaceholder: true,
          parentTxn: txn,
        },
      ];
    }
    return txn.items.map((item) => ({
      ...item,
      parentTxn: txn,
    }));
  });

  return (
    <div className="bg-bg-card border border-border-main rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[2200px] text-sm">
          <thead>
            <tr className="uppercase text-[11px] text-left border-b border-border-main bg-bg-main/20">
              <th className="px-6 py-4">ID</th>
              <th>Txn ID</th>
              <th>Type</th>
              <th>Party (Vendor/Client)</th>
              <th>Job No</th>
              <th>Invoice</th>
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
              <th className="text-green-600">Qty In</th>
              <th className="text-red-500">Qty Out</th>
              <th>Unit</th>
              <th>Location</th>
              <th>Rack</th>
              <th>Available</th>
              <th>Remarks</th>
              <th>Date</th>
              <th className="text-center sticky right-0 bg-bg-card shadow-[-4px_0_10px_rgba(0,0,0,0.1)]">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {flatData.map((row, idx) => {
              const { parentTxn } = row;

              if (row.isPlaceholder) {
                return (
                  <tr
                    key={`empty-${parentTxn.id}-${idx}`}
                    className="border-b border-border-main hover:bg-bg-main/10 transition"
                  >
                    <td className="px-6 py-4 text-text-muted">-</td>
                    <td className="font-semibold text-primary">
                      #{parentTxn.id}
                    </td>
                    <td>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${parentTxn.transaction_type === "IN" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}
                      >
                        {parentTxn.transaction_type === "IN"
                          ? "Stock In"
                          : "Stock Out"}
                      </span>
                    </td>
                    <td className="font-medium">
                      {parentTxn.vendor_name || parentTxn.client_name || "-"}
                    </td>
                    <td>{parentTxn.job_no || "-"}</td>
                    <td>{parentTxn.invoice_no || "-"}</td>
                    <td
                      colSpan="17"
                      className="text-center text-text-muted italic"
                    >
                      No items in this transaction
                    </td>
                    <td className="text-center sticky right-0 bg-bg-card shadow-[-4px_0_10px_rgba(0,0,0,0.1)]">
                      <div className="flex justify-center gap-3 px-2">
                        <Eye
                          size={16}
                          className="cursor-pointer hover:text-primary transition"
                          onClick={() => onView(parentTxn)}
                        />
                        <Pencil
                          size={16}
                          className="cursor-pointer text-amber-500 hover:opacity-70 transition"
                          onClick={() => onEdit(parentTxn)}
                        />
                        <Trash
                          size={16}
                          className="cursor-pointer text-red-500 hover:opacity-70 transition"
                          onClick={() => onDelete(parentTxn.id)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={`${row.id}-${idx}`}
                  className="border-b border-border-main hover:bg-bg-main/10 transition"
                >
                  <td className="px-6 py-4 font-medium">#{row.id}</td>
                  <td className="font-semibold text-primary">
                    #{parentTxn.id}
                  </td>
                  <td>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${parentTxn.transaction_type === "IN" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}
                    >
                      {parentTxn.transaction_type === "IN"
                        ? "Stock In"
                        : "Stock Out"}
                    </span>
                  </td>
                  <td className="font-medium">
                    {parentTxn.vendor_name || parentTxn.client_name || "-"}
                  </td>
                  <td>{parentTxn.job_no || "-"}</td>
                  <td>{parentTxn.invoice_no || "-"}</td>

                  <td className="font-bold">{row.product || "-"}</td>
                  <td>
                    {row.product_url ? (
                      <button
                        onClick={() => window.open(row.product_url, "_blank")}
                        className="p-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition"
                        title="View Image"
                      >
                        <Eye size={14} />
                      </button>
                    ) : (
                      <span className="text-text-muted text-[10px]">N/A</span>
                    )}
                  </td>
                  <td>{row.description || "-"}</td>
                  <td>{row.moc || "-"}</td>
                  <td>{row.grade || "-"}</td>
                  <td>{row.size1 || "-"}</td>
                  <td>{row.size2 || "-"}</td>
                  <td>{row.class_sch || "-"}</td>
                  <td>{row.sch2 || "-"}</td>
                  <td>{row.less_thk || "-"}</td>

                  <td className="text-green-600 font-bold">
                    {row.qty_in ?? 0}
                  </td>
                  <td className="text-red-500 font-bold">{row.qty_out ?? 0}</td>

                  <td>{row.unit || "-"}</td>
                  <td>{row.location || "-"}</td>
                  <td>{row.rack_no || "-"}</td>
                  <td className="font-bold text-primary">
                    {row.available_qty ?? 0}
                  </td>

                  <td
                    className="max-w-[150px] truncate"
                    title={parentTxn.remarks}
                  >
                    {parentTxn.remarks || "-"}
                  </td>
                  <td className="whitespace-nowrap">
                    {parentTxn.transaction_date
                      ? new Date(
                          parentTxn.transaction_date,
                        ).toLocaleDateString()
                      : "-"}
                  </td>

                  <td className="text-center sticky right-0 bg-bg-card shadow-[-4px_0_10px_rgba(0,0,0,0.1)]">
                    <div className="flex justify-center gap-3 px-2">
                      <Eye
                        size={16}
                        className="cursor-pointer hover:text-primary transition"
                        onClick={() => onView(parentTxn)}
                      />
                      <Pencil
                        size={16}
                        className="cursor-pointer text-amber-500 hover:opacity-70 transition"
                        onClick={() => onEdit(parentTxn)}
                      />
                      <Trash
                        size={16}
                        className="cursor-pointer text-red-500 hover:opacity-70 transition"
                        onClick={() => onDelete(parentTxn.id)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default IMS;
