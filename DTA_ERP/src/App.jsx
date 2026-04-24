import { Suspense, useEffect, lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useSelector } from "react-redux";
import LoginPage from "./pages/Login/LoginPage";
import Dashboard from "./pages/Dashboard";
import Delegation from "./pages/Delegation/Delegation";
import "./index.css";
import Loader from "./components/common/Loader";
import { Toaster } from "react-hot-toast";
import { logout } from "./store/slices/authSlice";
import axios from "axios";
import { useDispatch } from "react-redux";
import { checkAutoLogout } from "./utils/autoLogout";

const DelegationDetail = lazy(
  () => import("./pages/Delegation/DelegationDetail"),
);
const Checklist = lazy(() => import("./pages/Checklist/Checklist"));
const HelpTicket = lazy(() => import("./pages/HelpTicket/HelpTicket"));
const DemoModule = lazy(() => import("./pages/DemoModule")); // Reusable Demo Page
const PublicPage = lazy(() => import("./pages/PublicPage")); // Reusable Public Page
const ToDoBoard = lazy(() => import("./pages/ToDo/ToDoBoard"));
const IMS = lazy(() => import("./pages/IMS/Ims"));
const FMS = lazy(() => import("./pages/MainFMS/FMSPage"));
const O2D = lazy(() => import("./pages/O2D/O2D"));
const Score = lazy(() => import("./pages/Score/Score"));
const CombinedMIS = lazy(() => import("./pages/Score/CombinedMIS"));

// ── Task Management Pages ──────────────────────────────────────────────────────
const MyTasks         = lazy(() => import("./pages/Tasks/MyTasks"));
const DelegatedTasks  = lazy(() => import("./pages/Tasks/DelegatedTasks"));
const SubscribedTasks = lazy(() => import("./pages/Tasks/SubscribedTasks"));
const AllTasks        = lazy(() => import("./pages/Tasks/AllTasks"));
const DeletedTasks    = lazy(() => import("./pages/Tasks/DeletedTasks"));
const Notifications   = lazy(() => import("./pages/Notifications/Notifications"));

const ProtectedRoute = ({ children }) => {
  const { token } = useSelector((state) => state.auth);
  return token ? children : <Navigate to="/login" replace />;
};

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen bg-bg-main">
    <Loader className="w-64 h-64" />
  </div>
);

function App() {
  const dispatch = useDispatch();
  useEffect(() => {
    checkAutoLogout(dispatch, logout);

    const loginTime = localStorage.getItem("loginTime");

    if (!loginTime) return;

    const TEN_MIN = 8 * 60 * 60 * 1000;
    const remainingTime = TEN_MIN - (Date.now() - loginTime);

    if (remainingTime > 0) {
      const timer = setTimeout(() => {
        dispatch(logout());
      }, remainingTime);

      return () => clearTimeout(timer);
    }
  }, [dispatch]);

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (res) => res,
      (error) => {
        if (error.response?.status === 401) {
          dispatch(logout());
        }
        return Promise.reject(error);
      },
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, [dispatch]);

  return (
    <>
      <Toaster
        position="top-right"
        reverseOrder={false}
        gutter={10}
        toastOptions={{
          duration: 3500,
          style: {
            background: "#1e293b",
            color: "#f1f5f9",
            fontWeight: "600",
            fontSize: "13px",
            borderRadius: "12px",
            padding: "12px 16px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            border: "1px solid rgba(255,255,255,0.08)",
          },
          success: {
            duration: 3000,
            style: {
              background: "#16a34a",
              color: "#ffffff",
              fontWeight: "700",
              border: "2px solid #15803d",
              borderRadius: "12px",
              padding: "12px 16px",
              boxShadow: "0 8px 20px rgba(22,163,74,0.25)",
            },
            iconTheme: {
              primary: "#ffffff",
              secondary: "#16a34a",
            },
          },
          error: {
            duration: 4000,
            style: {
              background: "#dc2626",
              color: "#ffffff",
              fontWeight: "700",
              border: "2px solid #b91c1c",
              borderRadius: "12px",
              padding: "12px 16px",
              boxShadow: "0 8px 20px rgba(220,38,38,0.25)",
            },
            iconTheme: {
              primary: "#ffffff",
              secondary: "#dc2626",
            },
          },
          loading: {
            style: {
              background: "#1d4ed8",
              color: "#ffffff",
              fontWeight: "700",
              border: "2px solid #1e40af",
              borderRadius: "12px",
              padding: "12px 16px",
              boxShadow: "0 8px 20px rgba(29,78,216,0.25)",
            },
            iconTheme: {
              primary: "#ffffff",
              secondary: "#1d4ed8",
            },
          },
        }}
      />
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/delegation"
            element={
              <ProtectedRoute>
                <Delegation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/delegation/:id"
            element={
              <ProtectedRoute>
                <Suspense fallback={<LoadingFallback />}>
                  <DelegationDetail />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/checklist"
            element={
              <ProtectedRoute>
                <Suspense fallback={<LoadingFallback />}>
                  <Checklist />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ims"
            element={
              <ProtectedRoute>
                <Suspense fallback={<LoadingFallback />}>
                  <IMS />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/o2d"
            element={
              <ProtectedRoute>
                <Suspense fallback={<LoadingFallback />}>
                  <O2D />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/score"
            element={
              <ProtectedRoute>
                <Suspense fallback={<LoadingFallback />}>
                  <Score />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/combined-mis"
            element={
              <ProtectedRoute>
                <Suspense fallback={<LoadingFallback />}>
                  <CombinedMIS />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/help"
            element={
              <ProtectedRoute>
                <Suspense fallback={<LoadingFallback />}>
                  <HelpTicket />
                </Suspense>
              </ProtectedRoute>
            }
          />


          {/* ── Task Management Routes ── */}
          <Route path="/tasks/my-tasks" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><MyTasks /></Suspense></ProtectedRoute>} />
          <Route path="/tasks/delegated-tasks" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><DelegatedTasks /></Suspense></ProtectedRoute>} />
          <Route path="/tasks/subscribed-tasks" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><SubscribedTasks /></Suspense></ProtectedRoute>} />
          <Route path="/tasks/all-tasks" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><AllTasks /></Suspense></ProtectedRoute>} />
          <Route path="/tasks/deleted-tasks" element={<ProtectedRoute><Suspense fallback={<LoadingFallback />}><DeletedTasks /></Suspense></ProtectedRoute>} />

          {/* Demo Module Routes */}

          <Route
            path="/attendance"
            element={
              <ProtectedRoute>
                <Suspense fallback={<LoadingFallback />}>
                  <DemoModule type="attendance" />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/salary"
            element={
              <ProtectedRoute>
                <Suspense fallback={<LoadingFallback />}>
                  <DemoModule type="salary" />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/o2d-fms"
            element={
              <ProtectedRoute>
                <Suspense fallback={<LoadingFallback />}>
                  <FMS type="o2d-fms" />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/todo"
            element={
              <ProtectedRoute>
                <Suspense fallback={<LoadingFallback />}>
                  <ToDoBoard />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ims"
            element={
              <ProtectedRoute>
                <Suspense fallback={<LoadingFallback />}>
                  <DemoModule type="ims" />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/hrms"
            element={
              <ProtectedRoute>
                <Suspense fallback={<LoadingFallback />}>
                  <DemoModule type="hrms" />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Suspense fallback={<LoadingFallback />}>
                  <DemoModule type="profile" />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Suspense fallback={<LoadingFallback />}>
                  <Notifications />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Suspense fallback={<LoadingFallback />}>
                  <DemoModule type="settings" />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/help-demo"
            element={
              <ProtectedRoute>
                <Suspense fallback={<LoadingFallback />}>
                  <DemoModule type="help" />
                </Suspense>
              </ProtectedRoute>
            }
          />

          {/* Public Pages */}
          <Route
            path="/help-center"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <PublicPage type="help-center" />
              </Suspense>
            }
          />
          <Route
            path="/contact-support"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <PublicPage type="contact-support" />
              </Suspense>
            }
          />
          <Route
            path="/terms"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <PublicPage type="terms" />
              </Suspense>
            }
          />
          <Route
            path="/privacy"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <PublicPage type="privacy" />
              </Suspense>
            }
          />

          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;
