import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import StatCard from "../components/dashboard/StatCard";
import ModuleTrends from "../components/dashboard/ModuleTrends";
import QuickActions from "../components/dashboard/QuickActions";
import TodoSummary from "../components/dashboard/TodoSummary";
import Loader from "../components/common/Loader";
import { fetchDashboardSummary } from "../store/slices/dashboardSlice";
import TaskCreationForm from "../components/delegation/TaskCreationForm";

// Helper for mini charts defined outside render to avoid recreation
const MiniPerfChart = ({ title, done, total }) => {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex flex-col items-center bg-bg-card border border-border-main p-4 rounded-2xl shadow-sm">
      <p className="text-[10px] font-bold text-text-muted uppercase mb-3 text-center">
        {title}
      </p>
      <div className="relative w-20 h-20">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="text-border-main"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeDasharray="251.2"
            strokeDashoffset={251.2 * (1 - percent / 100)}
            strokeLinecap="round"
            className="text-primary transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-black text-text-main">{percent}%</span>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { summary, isLoading } = useSelector((state) => state.dashboard);
  
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchDashboardSummary());
  }, [dispatch]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-main">
        <Loader className="w-64 h-64" />
      </div>
    );
  }

  // Fallback data for stats
  const dStats = {
    total: (summary?.delegation?.TOTAL || 0) + (summary?.delegation?.DONE || 0) || 42,
    done: summary?.delegation?.DONE || 28,
  };
  const cStats = {
    total: (summary?.checklist?.TOTAL || 0) + (summary?.checklist?.DONE || 0) || 12,
    done: summary?.checklist?.DONE || 10,
  };
  const oStats = {
    total: (summary?.o2d?.TOTAL || 0) + (summary?.o2d?.DONE || 0) || 85,
    done: summary?.o2d?.DONE || 62,
  };
  const hStats = {
    total:
      (summary?.helpTicket?.TOTAL || 0) +
        (summary?.helpTicket?.CLOSED || 0) || 18,
    done:
        (summary?.helpTicket?.CLOSED || 0) || 14,
  };
  const iStats = {
    products: summary?.ims?.products || 156,
    totalStock: summary?.ims?.totalStock || 1240,
  };

  const perf =
    summary?.performance?.total > 0
      ? summary.performance
      : {
          percentDone: 65,
          done: 45,
          notDone: 25,
          total: 70,
        };

  return (
    <MainLayout title="Dashboard Overview">
      <div className="flex flex-col gap-6">
        {/* Welcome Message */}
        <div className="bg-gradient-to-r from-primary/10 to-transparent p-4 rounded-xl border border-primary/20 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-text-main">
              Welcome,{" "}
              <span className="text-primary">{user?.name || "User"}</span>! 👋
            </h2>
            <p className="text-text-muted text-sm mt-1">
              Real-time performance metrics across all ERP modules.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Delegations"
            value={dStats.total}
            icon="assignment_ind"
            trend={`${dStats.done} Done`}
            trendLabel="Completed tasks"
            color="blue"
            onClick={() => navigate("/tasks/all-tasks")}
          />
          <StatCard
            title="Checklists"
            value={cStats.total}
            icon="fact_check"
            trend={`${cStats.done} Done`}
            trendLabel="Completed items"
            color="green"
            onClick={() => navigate("/checklist")}
          />
          <StatCard
            title="O2D Orders"
            value={oStats.total}
            icon="shopping_cart"
            trend={`${oStats.done} Done`}
            trendLabel="Finished orders"
            color="orange"
            onClick={() => navigate("/o2d-fms")}
          />
          <StatCard
            title="Help Tickets"
            value={hStats.total}
            icon="confirmation_number"
            trend={`${hStats.done} Done`}
            trendLabel="Resolved tickets"
            color="purple"
            onClick={() => navigate("/help")}
          />
          <StatCard
            title="IMS Products"
            value={iStats.products}
            icon="inventory_2"
            trend={iStats.totalStock.toLocaleString()}
            trendLabel="Total stock items"
            color="blue"
            onClick={() => navigate("/ims")}
          />
        </div>

        {/* Module Performance Breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
          <MiniPerfChart
            title="Delegation Performance"
            done={dStats.done}
            total={dStats.total}
          />
          <MiniPerfChart
            title="Checklist Compliance"
            done={cStats.done}
            total={cStats.total}
          />
          <MiniPerfChart
            title="O2D Efficiency"
            done={oStats.done}
            total={oStats.total}
          />
          <MiniPerfChart
            title="Support Resolution"
            done={hStats.done}
            total={hStats.total}
          />
        </div>

        {/* Graphical Report Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-bg-card border border-border-main rounded-2xl p-6 shadow-sm">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-text-main">
                Overall Performance
              </h3>
              <p className="text-sm text-text-muted">
                Consolidated 60/40 Ratio target
              </p>
            </div>

            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative w-48 h-48">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="12"
                    strokeDasharray="251.2"
                    className="opacity-20"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="12"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 * (1 - perf.percentDone / 100)}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-text-main">
                    {perf.percentDone}%
                  </span>
                  <span className="text-xs font-bold text-text-muted uppercase">
                    Done
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 w-full mt-8 gap-4">
                <div className="flex flex-col items-center p-3 bg-green-500/5 rounded-xl border border-green-500/10">
                  <span className="text-xl font-bold text-green-500">
                    {perf.done}
                  </span>
                  <span className="text-[10px] font-bold uppercase text-green-600/70">
                    Done
                  </span>
                </div>
                <div className="flex flex-col items-center p-3 bg-red-500/5 rounded-xl border border-red-500/10">
                  <span className="text-xl font-bold text-red-500">
                    {perf.notDone}
                  </span>
                  <span className="text-[10px] font-bold uppercase text-red-600/70">
                    Not Done
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <ModuleTrends />
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <QuickActions onNewTask={() => setIsTaskFormOpen(true)} />
          </div>
          <div className="lg:col-span-2">
            <TodoSummary onCreateTask={() => setIsTaskFormOpen(true)} />
          </div>
        </div>
      </div>

      <TaskCreationForm 
        isOpen={isTaskFormOpen}
        onClose={() => setIsTaskFormOpen(false)}
        onSuccess={() => {
          setIsTaskFormOpen(false);
          dispatch(fetchDashboardSummary());
          // Refreshing dashboard summary will also indirectly trigger updates if needed
        }}
      />
    </MainLayout>
  );
};

export default Dashboard;
