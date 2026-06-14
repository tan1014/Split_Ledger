import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Layouts & Page imports
import Navbar from './components/Navbar.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Groups from './pages/Groups.jsx';
import Expenses from './pages/Expenses.jsx';
import Balances from './pages/Balances.jsx';
import ImportCSV from './pages/ImportCSV.jsx';
import ImportReport from './pages/ImportReport.jsx';
import Settings from './pages/Settings.jsx';

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export default function App() {
  return (
    <Router>
      <div className="app-layout">
        <Navbar />
        <Routes>
          {/* Public Auth routes */}
          <Route path="/login" element={<Login />} />

          {/* Protected Application routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/groups"
            element={
              <ProtectedRoute>
                <Groups />
              </ProtectedRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <ProtectedRoute>
                <Expenses />
              </ProtectedRoute>
            }
          />
          <Route
            path="/balances"
            element={
              <ProtectedRoute>
                <Balances />
              </ProtectedRoute>
            }
          />
          <Route
            path="/import"
            element={
              <ProtectedRoute>
                <ImportCSV />
              </ProtectedRoute>
            }
          />
          <Route
            path="/import/report/:jobId"
            element={
              <ProtectedRoute>
                <ImportReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}
