import React from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { UserRole } from "../types";
import { ShieldAlert, ArrowLeft } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500 font-medium">Verifying authorization...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 mx-auto bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 uppercase tracking-wider">
            403 - Forbidden Access
          </span>
          <h2 className="text-2xl font-bold text-slate-900 mt-3 mb-2">Restricted Access</h2>
          <p className="text-sm text-slate-600 mb-6">
            Your current account role <span className="font-semibold text-slate-800">({user.role})</span> does not have administrative clearance to access this module. You are permitted to manage loan portfolios only.
          </p>
          <Link
            to="/loans"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-lg transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Loan Portfolio
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
