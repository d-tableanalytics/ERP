import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import MainLayout from "../../components/layout/MainLayout";
import Loader from "../../components/common/Loader";
import StatCard from "./StatCard";

import { fetchScoreData } from "../../store/slices/scoreSlice";

const Score = () => {
  const dispatch = useDispatch();

  /* =============================== */
  /* ✅ Redux State */
  /* =============================== */
  const { scoreList = [], isLoading } = useSelector((state) => state.score);

  /* =============================== */
  /* ✅ Filters */
  /* =============================== */
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedWeek, setSelectedWeek] = useState("ALL");

  /* =============================== */
  /* ✅ Dynamic Options */
  /* =============================== */
  const statusOptions = React.useMemo(() => {
    const statuses = scoreList
      .map((s) => s.status)
      .filter(Boolean);
    return ["ALL", ...new Set(statuses)];
  }, [scoreList]);

  const weekOptions = React.useMemo(() => {
    const weeks = scoreList
      .map((s) => s.week_no)
      .filter(Boolean);

    return ["ALL", ...new Set(weeks)];
  }, [scoreList]);

  /* =============================== */
  /* ✅ Pagination */
  /* =============================== */
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  /* =============================== */
  /* ✅ Fetch Score Data */
  /* =============================== */
  useEffect(() => {
    dispatch(fetchScoreData());
  }, [dispatch]);

  /* =============================== */
  /* ✅ Filtering Logic */
  /* =============================== */
  const filteredScores = React.useMemo(() => {
    let data = Array.isArray(scoreList) ? [...scoreList] : [];

    /* 🔍 Search Filter */
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();

      data = data.filter((s) => {
        return (
          s.name?.toLowerCase().includes(term) ||
          s.task?.toLowerCase().includes(term) ||
          s.week_no?.toString().toLowerCase().includes(term)
        );
      });
    }

    /* 🎯 Status Filter */
    if (selectedStatus !== "ALL") {
      // Use exact comparison since options are derived from data
      data = data.filter((s) => s.status === selectedStatus);
    }

    /* 📅 Week Filter */
    if (selectedWeek !== "ALL") {
      data = data.filter((s) => s.week_no === selectedWeek);
    }

    return data;
  }, [scoreList, searchTerm, selectedStatus, selectedWeek]);

  /* =============================== */
  /* ✅ Pagination Logic */
  /* =============================== */
  const totalPages = Math.ceil(filteredScores.length / itemsPerPage);

  const paginatedScores = filteredScores.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  /* Reset Page when Filters Change */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [searchTerm, selectedStatus, selectedWeek]);

  /* =============================== */
  /* ✅ Status Badge Colors */
  /* =============================== */
  const getStatusStyle = (status) => {
    if (!status) return "bg-gray-500/10 text-gray-500";

    const s = status.toUpperCase();

    if (s.includes("REVISION")) return "bg-red-500/10 text-red-500";
    if (s.includes("HOLD")) return "bg-orange-500/10 text-orange-500";
    if (s.includes("CLARITY")) return "bg-purple-500/10 text-purple-500";
    if (s.includes("COMPLETED") || s.includes("VERIFIED")) return "bg-green-500/10 text-green-600";
    if (s.includes("PENDING") || s.includes("PROGRESS")) return "bg-blue-500/10 text-blue-500";

    return "bg-gray-500/10 text-gray-500";
  };

  return (
    <MainLayout title="Score Management">
      {/* ✅ Dashboard Cards */}
      <StatCard />

      <div className="flex flex-col gap-4 p-3">

        {/* ===================================== */}
        {/* ✅ Toolbar Filters */}
        {/* ===================================== */}
        <div className="flex flex-row gap-4 justify-end bg-bg-card border border-border-main rounded-xl p-4 shadow-sm">

          {/* 🔍 Search */}
          <div>
            <label className="text-[10px] font-bold uppercase text-text-muted">
              Search (Name / Task)
            </label>

            <input
              type="text"
              placeholder="Search anything..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-1 bg-bg-main border border-border-main rounded-xl px-3 py-2 text-sm w-[260px]"
            />
          </div>

          {/* 🎯 Status Dropdown */}
          <div>
            <label className="text-[10px] font-bold uppercase text-text-muted">
              Filter by Status
            </label>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="mt-1 bg-bg-main border border-border-main rounded-xl px-3 py-2 text-sm w-[200px]"
            >
              {statusOptions.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* 📅 Week Dropdown */}
          <div>
            <label className="text-[10px] font-bold uppercase text-text-muted">
              Filter by Week
            </label>

            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="mt-1 bg-bg-main border border-border-main rounded-xl px-3 py-2 text-sm w-[200px]"
            >
              {weekOptions.map((wk) => (
                <option key={wk} value={wk}>
                  {wk}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ===================================== */}
        {/* ✅ Loading + Empty */}
        {/* ===================================== */}
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader />
          </div>
        ) : paginatedScores.length === 0 ? (
          <div className="text-center p-12 text-text-muted font-bold">
            No Score Data Found
          </div>
        ) : (
          <>
            {/* ===================================== */}
            {/* ✅ Table */}
            {/* ===================================== */}
            <div className="bg-bg-card border border-border-main rounded-2xl overflow-hidden shadow-sm overflow-x-auto">

              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="bg-bg-main/40 text-text-muted uppercase text-[10px]">
                    <th className="px-4 py-4 text-left w-[15%]">Name</th>
                    <th className="px-4 py-4 text-left w-[30%]">Task</th>
                    <th className="px-4 py-4 text-center w-[15%]">Date</th>
                    <th className="px-4 py-4 text-center w-[10%]">Score</th>
                    <th className="px-4 py-4 text-center w-[15%]">Status</th>
                    <th className="px-4 py-4 text-center w-[15%]">Week</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedScores.map((score) => (
                    <tr
                      key={score?.id}
                      className="border-t border-border-main hover:bg-bg-main/20"
                    >
                      <td className="px-4 py-4 font-semibold truncate">
                        {score?.name}
                      </td>

                      <td className="px-4 py-4 truncate">
                        {score?.task}
                      </td>

                      <td className="px-4 py-4 text-center text-xs text-text-muted">
                        {score?.date
                          ? new Date(score.date).toLocaleDateString()
                          : "-"}
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-bold text-xs">
                          {score?.score}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span
                          className={`px-3 py-1 rounded-full font-bold text-xs ${getStatusStyle(
                            score?.status
                          )}`}
                        >
                          {score?.status}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-center font-bold">
                        {score?.week_no}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* ===================================== */}
              {/* ✅ Pagination */}
              {/* ===================================== */}
              <div className="flex justify-between items-center px-5 py-3 border-t border-border-main text-xs">

                <p className="text-text-muted font-bold">
                  Showing {(currentPage - 1) * itemsPerPage + 1}–
                  {Math.min(
                    currentPage * itemsPerPage,
                    filteredScores.length
                  )}{" "}
                  of {filteredScores.length}
                </p>

                <div className="flex gap-2 items-center">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="px-3 py-1 rounded-lg border disabled:opacity-40"
                  >
                    Prev
                  </button>

                  <span className="px-3 py-1 rounded-lg border font-bold bg-bg-main">
                    {currentPage}
                  </span>

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="px-3 py-1 rounded-lg border disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default Score;
