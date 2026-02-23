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
  const [searchTerm, setSearchTerm] = useState("");
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
  const mocOptions = [
    ...new Set(allItems.map((i) => i.moc).filter(Boolean)),
  ];
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
  const sch2Options = [
    ...new Set(allItems.map((i) => i.sch2).filter(Boolean)),
  ];

  const partyOptions = [
    ...new Set(
      (transactions || [])
        .map((t) => t?.vendor_name || t?.client_name)
        .filter(Boolean)
    ),
  ];

  /* ================= FILTERING ================= */
  const filteredTransactions = useMemo(() => {
    let data = [...transactions];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      data = data.filter(
        (t) =>
          t.invoice_no?.toLowerCase().includes(term) ||
          t.job_no?.toLowerCase().includes(term)
      );
    }

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
            txn.client_name
              ?.toLowerCase()
              .includes(partyFilter.toLowerCase()))
        );
      });
    });

    return data;
  }, [
    transactions,
    searchTerm,
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
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
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
              Loading delegations...
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
  const [expandedRow, setExpandedRow] = useState(null);
  return (
    <div className="bg-bg-card border border-border-main rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] text-sm">
          <thead>
            <tr className="uppercase text-[11px] text-left border-b border-border-main">
              <th className="px-6 py-4">ID</th>
              <th>User ID</th>
              <th>Type</th>
              <th>Vendor</th>
              <th>Client</th>
              <th>Job No</th>
              <th>Invoice</th>
              <th>Remarks</th>
              <th>Transaction Date</th>
              <th>Created At</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {data.map((txn) => (
              <React.Fragment key={txn.id}>
                {/* MAIN ROW */}
                <tr className="border-b bg-bg-main/40 border-border-main hover:bg-bg-main/20 transition">
                  <td
                    className="px-6 py-4 font-semibold cursor-pointer"
                    onClick={() =>
                      setExpandedRow(expandedRow === txn.id ? null : txn.id)
                    }
                  >
                    #{txn.id}
                  </td>

                  <td>{txn.user_id ?? 0}</td>

                  <td>
                    <span
                      className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wide
                        ${
                          txn.transaction_type === "IN"
                            ? "bg-green-500/10 text-green-600 border border-green-500/20"
                            : "bg-red-500/10 text-red-600 border border-red-500/20"
                        }`}
                    >
                      {txn.transaction_type === "IN" ? "Stock In" : "Stock Out"}
                    </span>
                  </td>

                  <td>{txn.vendor_name || "-"}</td>
                  <td>{txn.client_name || "-"}</td>
                  <td>{txn.job_no || "-"}</td>
                  <td>{txn.invoice_no || "-"}</td>
                  <td>{txn.remarks || "-"}</td>

                  <td>
                    {txn.transaction_date
                      ? new Date(txn.transaction_date).toLocaleString()
                      : "-"}
                  </td>

                  <td>
                    {txn.created_at
                      ? new Date(txn.created_at).toLocaleString()
                      : "-"}
                  </td>

                  <td>
                    <div className="flex justify-center gap-4">
                      <Eye
                        size={16}
                        className="cursor-pointer"
                        onClick={() => onView(txn)}
                      />
                      <Pencil
                        size={16}
                        className="cursor-pointer text-amber-500"
                        onClick={() => onEdit(txn)}
                      />
                      <Trash
                        size={16}
                        className="cursor-pointer text-red-500"
                        onClick={() => onDelete(txn.id)}
                      />
                    </div>
                  </td>
                </tr>

                {/* EXPANDED TABLE */}
                {expandedRow === txn.id && (
                  <tr>
                    <td colSpan="11" className="bg-bg-main p-4">
                      <div className="overflow-x-auto border border-border-main rounded-xl">
                        <table className="w-full min-w-[1300px] text-xs">
                          <thead className="bg-bg-card border-b">
                            <tr>
                              <th>ID</th>
                              <th>Transaction ID</th>
                              <th>Product</th>
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
                              <th>Item Created</th>
                            </tr>
                          </thead>

                          <tbody>
                            {txn.items && txn.items.length > 0 ? (
                              txn?.items.map((item) => (
                                <tr key={item?.id} className="border-b">
                                  <td>{item?.id ?? 0}</td>
                                  <td>{item?.transaction_id ?? 0}</td>
                                  <td>{item?.product || "-"}</td>
                                  <td>{item?.description || "-"}</td>
                                  <td>{item?.moc || "-"}</td>
                                  <td>{item?.grade || "-"}</td>
                                  <td>{item?.size1 || "-"}</td>
                                  <td>{item?.size2 || "-"}</td>
                                  <td>{item?.class_sch || "-"}</td>
                                  <td>{item?.sch2 || "-"}</td>
                                  <td>{item?.less_thk || "-"}</td>

                                  <td className="text-green-600 font-semibold">
                                    {item?.qty_in ?? 0}
                                  </td>

                                  <td className="text-red-500 font-semibold">
                                    {item?.qty_out ?? 0}
                                  </td>

                                  <td>{item?.unit || "-"}</td>
                                  <td>{item?.location || "-"}</td>
                                  <td>{item?.rack_no || "-"}</td>
                                  <td>{item?.available_qty ?? 0}</td>

                                  <td>
                                    {item?.created_at
                                      ? new Date(
                                          item?.created_at,
                                        ).toLocaleString()
                                      : "-"}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td
                                  colSpan="18"
                                  className="text-center py-4 text-gray-500"
                                >
                                  No Items Found
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default IMS;
