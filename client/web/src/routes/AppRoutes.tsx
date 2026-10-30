import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";
import { AppLayout } from "../components/layout/AppLayout";
import { LoginPage } from "../features/auth/LoginPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { LoansPage } from "../features/loans/LoansPage";
import { MembersPage } from "../features/members/MembersPage";
import { ContributionsPage } from "../features/contributions/ContributionsPage";
import { AccountingPage } from "../features/accounting/AccountingPage";
import { DistributionPage } from "../features/distribution/DistributionPage";
import { SettingsPage } from "../features/settings/SettingsPage";

const RootRedirect: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return user.role === "Admin" ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <Navigate to="/loans" replace />
  );
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RootRedirect />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/members"
          element={
            <ProtectedRoute allowedRoles={["Admin", "User"]}>
              <MembersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contributions"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <ContributionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <AccountingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/distribution"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <DistributionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/loans"
          element={
            <ProtectedRoute allowedRoles={["Admin", "User"]}>
              <LoansPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/users"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={<Navigate to="/settings/users" replace />}
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
