import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider, useSelector } from 'react-redux';
import { store } from './store/store';
import LoginPage from './pages/Login/LoginPage';
import Dashboard from './pages/Dashboard';
import Delegation from './pages/Delegation/Delegation';
import './index.css';
import Loader from './components/common/Loader';
import { Toaster } from 'react-hot-toast';

// Lazy load the DelegationDetail component
const DelegationDetail = lazy(() => import('./pages/Delegation/DelegationDetail'));
const Checklist = lazy(() => import('./pages/Checklist/Checklist'));
const HelpTicket = lazy(() => import('./pages/HelpTicket/HelpTicket'));

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
  return (
    <Provider store={store}>
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{
          style: {
            background: '#333',
            color: '#fff',
          },
          success: {
            style: {
              background: '#22c55e', // Bright Green
              color: '#ffffff',
              fontWeight: 'bold',
              border: '2px solid #166534',
            },
            iconTheme: {
              primary: '#ffffff',
              secondary: '#22c55e',
            },
          },
          error: {
            style: {
              background: '#ef4444', // Bright Red
              color: '#ffffff',
              fontWeight: 'bold',
              border: '2px solid #991b1b',
            },
            iconTheme: {
              primary: '#ffffff',
              secondary: '#ef4444',
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
            path="/help"
            element={
              <ProtectedRoute>
                <Suspense fallback={<LoadingFallback />}>
                  <HelpTicket />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </Provider>
  );
}

export default App;