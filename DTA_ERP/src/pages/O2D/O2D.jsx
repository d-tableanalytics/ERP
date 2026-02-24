import React, { useState, useEffect, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import AutoSuggestInput from "../../components/common/AutoSuggestInput";

import MainLayout from "../../components/layout/MainLayout";
import CreateO2DModal from "../../components/o2d/CreateO2DModal";
import ViewO2DModal from "../../components/o2d/ViewO2DModal";
import O2DCard from "../../components/o2d/O2DCard";
import Loader from "../../components/common/Loader";
import AssignStepModal from "../../components/o2d/AssignStepModal";
import CompleteStepModal from "../../components/o2d/CompleteStepModal";

import { Eye } from "lucide-react";

import {
  fetchO2DOrders,
  assignO2DStep,
  completeO2DStep,
} from "../../store/slices/o2dSlice";

import { fetchEmployees } from "../../store/slices/masterSlice";

const O2D = () => {
  const dispatch = useDispatch();

  const { orders = [], isLoading } = useSelector((state) => state.o2d);
  const { employees = [] } = useSelector((state) => state.master);

  const [viewMode, setViewMode] = useState("table");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [selectedStep, setSelectedStep] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 5;

  /* ================= Fetch ================= */
  useEffect(() => {
    dispatch(fetchO2DOrders());
    dispatch(fetchEmployees());
  }, [dispatch]);

  /* ================= Unique Steps ================= */
  const uniqueSteps = useMemo(() => {
    const stepSet = new Set();
    orders.forEach((order) => {
      order.steps?.forEach((step) => {
        stepSet.add(step.step_name);
      });
    });
    return Array.from(stepSet);
  }, [orders]);

  /* ================= Product Suggestions ================= */
  const productSuggestions = useMemo(() => {
    const setProducts = new Set();
    orders.forEach((order) => {
      order.items?.forEach((item) => {
        setProducts.add(item.item_name);
      });
    });
    return Array.from(setProducts);
  }, [orders]);

  /* ================= Filtering ================= */
  const filteredOrders = useMemo(() => {
    let data = Array.isArray(orders) ? orders : [];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      data = data.filter((o) =>
        o?.party_name?.toLowerCase().includes(term) ||
        o?.customer_type?.toLowerCase().includes(term) ||
        o?.location?.toLowerCase().includes(term) ||
        o?.state?.toLowerCase().includes(term)
      );
    }

    if (productFilter.trim()) {
      const prod = productFilter.toLowerCase();
      data = data.filter((o) =>
        o.items?.some((item) =>
          item.item_name.toLowerCase().includes(prod)
        )
      );
    }

    return data;
  }, [orders, searchTerm, productFilter]);

  /* ================= Pagination ================= */
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, productFilter]);

  /* ================= Helpers ================= */
  const getEmployeeName = (id) => {
    const emp = employees.find((e) => e.id === id);
    return emp ? `${emp.First_Name} ${emp.Last_Name}` : "-";
  };

  const formatDate = (date) =>
    date ? new Date(date).toLocaleDateString() : "-";

  const getStepData = (order, stepName) => {
    return order.steps?.find((s) => s.step_name === stepName);
  };

  /* ================= Assign ================= */
  const handleAssign = (employeeId) => {
    if (!selectedStep || !selectedOrderId) return;

    dispatch(
      assignO2DStep({
        orderId: selectedOrderId,
        stepId: selectedStep.id,
        assigned_to: employeeId,
      })
    );

    setIsAssignOpen(false);
    setSelectedStep(null);
  };

  /* ================= Complete ================= */
  const handleComplete = (remarksText) => {
    if (!selectedStep || !selectedOrderId) return;

    dispatch(
      completeO2DStep({
        orderId: selectedOrderId,
        stepId: selectedStep.id,
        remarks: remarksText,
      })
    );

    setIsCompleteOpen(false);
    setSelectedStep(null);
  };

  return (
    <MainLayout title="O2D Management">
      <div className="flex flex-col gap-6 p-6">

        {/* ================= Toolbar ================= */}
        <div className="flex flex-wrap gap-4 bg-bg-card rounded-xl p-4 justify-between">

          <div className="flex gap-4 items-center">

            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("table")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  viewMode === "table"
                    ? "bg-primary text-white"
                    : "border border-border-main"
                }`}
              >
                Table
              </button>

              <button
                onClick={() => setViewMode("tiles")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  viewMode === "tiles"
                    ? "bg-primary text-white"
                    : "border border-border-main"
                }`}
              >
                Tiles
              </button>
            </div>

            <input
              type="text"
              placeholder="Search Order..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-border-main rounded-xl px-3 py-2 w-[220px]"
            />

            <AutoSuggestInput
              placeholder="Filter by Product..."
              value={productFilter}
              onChange={setProductFilter}
              suggestions={productSuggestions}
            />
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="bg-primary text-white px-5 py-2 rounded-xl font-bold"
          >
            + Create O2D
          </button>
        </div>

        {/* ================= Loading ================= */}
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader />
          </div>
        ) : viewMode === "table" ? (

          <div className="bg-bg-card border border-border-main rounded-2xl">

            {/* Table Scroll */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[2200px]">
                <thead>
                  <tr className="bg-bg-main/40 uppercase">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Party Info</th>
                    <th className="px-4 py-3">Contact & Items</th>
                    <th className="px-4 py-3">Customer Type</th>
                    <th className="px-4 py-3">Representative</th>

                    {uniqueSteps.map((stepName) => (
                      <th key={stepName} className="px-4 py-3 text-center">
                        {stepName}
                      </th>
                    ))}

                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedOrders.map((order) => (
                    <tr key={order.id} className="border-t align-top">

                      <td className="px-4 py-3 font-bold">#{order.id}</td>

                      <td className="px-4 py-3">
                        {order.party_name}<br/>
                        {order.email}<br/>
                        {order.location}, {order.state}
                      </td>

                      <td className="px-4 py-3">
                        <div>{order.contact_no}</div>
                        {order.items?.length > 0 && (
                          <ul className="mt-2 list-disc ml-4 text-[11px] text-text-muted">
                            {order.items.map((item) => (
                              <li key={item.id}>
                                {item.item_name} (Qty: {item.qty})
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>

                      <td className="px-4 py-3">{order.customer_type}</td>
                      <td className="px-4 py-3">{order.representative}</td>

                      {uniqueSteps.map((stepName) => {
                        const step = getStepData(order, stepName);

                        return (
                          <td
                            key={stepName}
                            className="px-4 py-3 border-l text-[11px] cursor-pointer hover:bg-bg-main/40 transition"
                            onClick={() => {
                              if (!step) return;

                              setSelectedOrderId(order.id);
                              setSelectedStep(step);

                              if (!step.assigned_to) {
                                setIsAssignOpen(true);
                              } else if (step.status !== "COMPLETED") {
                                setIsCompleteOpen(true);
                              }
                            }}
                          >
                            {step ? (
                              <div className="space-y-1">
                                <div><b>Assigned:</b> {getEmployeeName(step.assigned_to)}</div>
                                <div><b>Planned:</b> {formatDate(step.planned_date)}</div>
                                <div><b>Actual:</b> {formatDate(step.actual_date)}</div>
                                <div><b>Status:</b> {step.status || "PENDING"}</div>
                              </div>
                            ) : "-"}
                          </td>
                        );
                      })}

                      <td className="px-4 py-3 font-bold">
                        {order.overall_status}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setIsViewOpen(true);
                          }}
                        >
                          <Eye size={16} />
                        </button>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center px-6 py-5 border-t bg-bg-main/30 rounded-b-2xl mt-4">
              <div>
                Showing {(currentPage - 1) * itemsPerPage + 1}–
                {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length}
              </div>

              <div className="flex gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="px-3 py-1 border rounded-lg"
                >
                  Prev
                </button>

                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`px-3 py-1 rounded-lg ${
                      currentPage === i + 1
                        ? "bg-primary text-white"
                        : "border"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="px-3 py-1 border rounded-lg"
                >
                  Next
                </button>
              </div>
            </div>

          </div>

        ) : (

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {paginatedOrders.map((order) => (
              <O2DCard
                key={order.id}
                o2d={order}
                onView={() => {
                  setSelectedOrder(order);
                  setIsViewOpen(true);
                }}
              />
            ))}
          </div>

        )}

        <AssignStepModal
          isOpen={isAssignOpen}
          onClose={() => setIsAssignOpen(false)}
          employees={employees}
          onAssign={handleAssign}
        />

        <CompleteStepModal
          isOpen={isCompleteOpen}
          onClose={() => setIsCompleteOpen(false)}
          onComplete={handleComplete}
        />

        <ViewO2DModal
          isOpen={isViewOpen}
          onClose={() => setIsViewOpen(false)}
          o2d={selectedOrder}
        />

        <CreateO2DModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => dispatch(fetchO2DOrders())}
        />

      </div>
    </MainLayout>
  );
};

export default O2D;