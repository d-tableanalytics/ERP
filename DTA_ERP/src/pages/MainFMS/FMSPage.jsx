import { useState, useMemo } from "react";
import MainLayout from "../../components/layout/MainLayout";
import FMSTabs from "./FMSTabs";
import DataTable from "./DataTable";
import TablePagination from "./TablePagination";
import TableFilters from "./TableFilters";
import { FMS_TABS } from "./FMS.data.js";
import POCheckModal from "./modals/POCheckModal";
const ITEMS_PER_PAGE = 7;

const Delegation = () => {
  const [stepsData, setStepsData] = useState(FMS_TABS);
  const [activeTab, setActiveTab] = useState(FMS_TABS[0].key);
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  const handleActionClick = (row, header) => {
    if (header === "P.O CHECK") {
      setSelectedRow(row);
      setIsModalOpen(true);
    }
  };

  const handleStatusChange = (row, newStatus) => {
    if (newStatus !== "DONE") {
      // Update status in current step
      setStepsData((prev) =>
        prev.map((step) => {
          if (step.key === activeTab) {
            return {
              ...step,
              data: step.data.map((r) =>
                r === row ? { ...r, status: newStatus } : r
              ),
            };
          }
          return step;
        })
      );
      return;
    }

    // Move to next step if status is DONE
    const currentIndex = stepsData.findIndex((s) => s.key === activeTab);
    if (currentIndex === -1 || currentIndex === stepsData.length - 1) return;

    const nextStep = stepsData[currentIndex + 1];

    // Basic mapping logic for demo
    const movedRow = { ...row, status: "NOT DONE" };

    // Adapt row fields if moving from Step 1 to Step 2
    if (activeTab === "step1" && nextStep.key === "step2") {
      movedRow.poNumber = row.PONumber;
      movedRow.company = row.Company;
      movedRow.orderQty = row.Qty;
      movedRow.orderItem = row.Item;
      movedRow.planned = new Date().toLocaleDateString();
      movedRow.actual = "-";
      movedRow.inspection = "OKAY";
      movedRow.doc = "OKAY";
      movedRow.delDate = "OKAY";
      movedRow.gst = "OKAY";
      movedRow.hsn = "OKAY";
      movedRow.qtyCheck = "OKAY";
      movedRow.rate = "OKAY";
      movedRow.itemCheck = "OKAY";
      movedRow.poAmd = "NO";
      movedRow.link = "-";
      movedRow.doer = "System";
      movedRow.delay = "-";
      movedRow.action = "Action";
    }

    setStepsData((prev) => {
      const updated = [...prev];
      // Remove from current
      updated[currentIndex] = {
        ...updated[currentIndex],
        data: updated[currentIndex].data.filter((r) => r !== row),
        badge: updated[currentIndex].data.length - 1
      };
      // Add to next
      updated[currentIndex + 1] = {
        ...updated[currentIndex + 1],
        data: [...updated[currentIndex + 1].data, movedRow],
        badge: updated[currentIndex + 1].data.length + 1
      };
      return updated;
    });
  };

  const [search, setSearch] = useState({
    firm: "",
    buyer: "",
    item: "",
    uid: "",
    po: ""
  });

  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  /* ------------------ CURRENT TAB ------------------ */
  const currentTab = useMemo(
    () => stepsData.find((t) => t.key === activeTab),
    [activeTab, stepsData],
  );

  /* ------------------ FILTER + SORT ------------------ */
  const filteredData = useMemo(() => {
    let data = [...currentTab.data];

    // Search (generic: checks all values)
    Object.values(search).forEach((value) => {
      if (!value) return;
      data = data.filter((row) =>
        Object.values(row).some((cell) =>
          String(cell).toLowerCase().includes(value.toLowerCase()),
        ),
      );
    });

    // Sorting
    if (sortConfig.key) {
      data.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key])
          return sortConfig.direction === "asc" ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key])
          return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [currentTab.data, search, sortConfig]);

  /* ------------------ PAGINATION ------------------ */
  const paginatedData = filteredData.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  return (
    <MainLayout title="O2D FMS">
      {/* Filters */}
      <TableFilters values={search} onChange={setSearch} />

      {/* Tabs */}
      <FMSTabs
        tabs={stepsData}
        activeTab={activeTab}
        onChange={(key) => {
          setActiveTab(key);
          setPage(1);
        }}
      />

      {/* Table */}
      <DataTable
        columns={currentTab.columns}
        header={currentTab.header}
        onAction={handleActionClick}
        onStatusChange={handleStatusChange}
        data={paginatedData}
        sortConfig={sortConfig}
        onSort={(key) =>
          setSortConfig((prev) => ({
            key,
            direction:
              prev.key === key && prev.direction === "asc" ? "desc" : "asc",
          }))
        }
      />

      {/* Pagination */}
      <TablePagination
        page={page}
        setPage={setPage}
        total={filteredData.length}
        limit={ITEMS_PER_PAGE}
      />
      <POCheckModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        poNumber={selectedRow?.poNumber}
      />
    </MainLayout>
  );
};

export default Delegation;
