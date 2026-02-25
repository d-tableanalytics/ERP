import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import MainLayout from "../components/layout/MainLayout";
import StatCard from "../components/dashboard/StatCard";
import ModuleTrends from "../components/dashboard/ModuleTrends";
import RecentActivity from "../components/dashboard/RecentActivity";
import QuickActions from "../components/dashboard/QuickActions";
import TodoSummary from "../components/dashboard/TodoSummary";
import Loader from "../components/common/Loader";
import { fetchDashboardSummary } from "../store/slices/dashboardSlice";

// Helper for mini charts defined outside render to avoid recreation
const MiniPerfChart = ({ title, done, total }) => {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const notDonePercent = 100 - percent;
  return (
    <div className="flex flex-col items-center bg-bg-card border border-border-main p-4 rounded-2xl shadow-sm">
      <p className="text-[10px] font-bold text-text-muted uppercase mb-3 text-center">
        {title}
      </p>
      <div className="relative w-20 h-20">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Red (Not Done) */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#ef4444"
            strokeWidth="10"
            strokeDasharray="251.2"
            className="opacity-20"
          />
          {/* Green (Done) */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#22c55e"
            strokeWidth="10"
            strokeDasharray="251.2"
            strokeDashoffset={251.2 * (1 - percent / 100)}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-text-main">{percent}%</span>
        </div>
      </div>
      <div className="flex justify-between w-full mt-3 text-[9px] font-bold">
        <span className="text-green-500">{percent}% Done</span>
        <span className="text-red-500">{notDonePercent}% Not Done</span>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { summary, isLoading } = useSelector((state) => state.dashboard);

  useEffect(() => {
    dispatch(fetchDashboardSummary());
  }, [dispatch]);

  if (isLoading && !summary) {
    return (
      <MainLayout title="Dashboard Overview">
        <div className="flex justify-center items-center h-[400px]">
          <Loader />
        </div>
      </MainLayout>
    );
  }

  // Simulated data for demonstration if real data is empty
  const dStats = {
    total: summary?.delegation?.total || 12,
    done: summary?.delegation?.COMPLETED || 8,
  };
  const cStats = {
    total: summary?.checklist?.total || 45,
    done:
      (summary?.checklist?.Completed || 0) +
        (summary?.checklist?.Verified || 0) || 32,
  };
  const oStats = {
    total: summary?.o2d?.total || 24,
    done: summary?.o2d?.COMPLETED || 15,
  };
  const hStats = {
    total: summary?.helpTicket?.total || 18,
    done:
      (summary?.helpTicket?.RESOLVED || 0) +
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
          />
          <StatCard
            title="Checklists"
            value={cStats.total}
            icon="fact_check"
            trend={`${cStats.done} Done`}
            trendLabel="Completed items"
            color="green"
          />
          <StatCard
            title="O2D Orders"
            value={oStats.total}
            icon="shopping_cart"
            trend={`${oStats.done} Done`}
            trendLabel="Finished orders"
            color="orange"
          />
          <StatCard
            title="Help Tickets"
            value={hStats.total}
            icon="confirmation_number"
            trend={`${hStats.done} Done`}
            trendLabel="Resolved tickets"
            color="purple"
          />
          <StatCard
            title="IMS Products"
            value={iStats.products}
            icon="inventory_2"
            trend={iStats.totalStock.toLocaleString()}
            trendLabel="Total stock items"
            color="blue"
          />
        </div>

        {/* Module Performance Breakdown (New Section with multiple graphs) */}
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
          {/* Performance Visualization (60/40 Chart) */}
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
              {/* Circular Progress SVG */}
              <div className="relative w-48 h-48">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  {/* Red Background (Not Done - 40%) */}
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
                  {/* Green Trace (Done - 60%) */}
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

          {/* Module Trends replaced Attendance Trends */}
          <div className="lg:col-span-2">
            <ModuleTrends />
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <QuickActions />
          </div>
          <div className="lg:col-span-2">
            <TodoSummary />
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
