import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Landmark, Shield, User, Lock, ArrowRight, AlertCircle } from "lucide-react";

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLoginSubmit = async (e?: React.FormEvent, customUser?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    const userToLogin = customUser || username;
    const passToLogin = customPass || password;

    try {
      const loggedUser = await login(userToLogin, passToLogin);
      const origin = (location.state as { from?: { pathname: string } })?.from?.pathname;
      if (origin && origin !== "/login") {
        navigate(origin, { replace: true });
      } else if (loggedUser.role === "Admin") {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/loans", { replace: true });
      }
    } catch (err: unknown) {
      const errorResponse = err as { response?: { data?: { message?: string } } };
      setError(
        errorResponse?.response?.data?.message || "Authentication failed. Please verify credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdminLogin = () => {
    setUsername("admin");
    setPassword("Admin123!");
    handleLoginSubmit(undefined, "admin", "Admin123!");
  };

  const handleQuickUserLogin = () => {
    setUsername("loanuser");
    setPassword("User123!");
    handleLoginSubmit(undefined, "loanuser", "User123!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500 mx-auto flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 mb-4">
          <Landmark className="w-9 h-9" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-white">CoopIS Portal</h2>
        <p className="mt-2 text-sm text-slate-300">
          Clean Architecture Cooperative Management System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-2xl rounded-2xl border border-slate-100">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-rose-700 font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={(e) => handleLoginSubmit(e)} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Username / Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin or loanuser"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-sm transition-colors shadow-md shadow-emerald-600/20 disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Sign In to Account"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Demo Quick-Login Buttons Section */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-center text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              One-Click Demo Credentials
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleQuickAdminLogin}
                disabled={loading}
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80 active:bg-emerald-200 text-emerald-900 transition-all text-left"
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-800">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  Login as Admin
                </div>
                <span className="text-[11px] text-emerald-700 mt-0.5">Full System Access</span>
              </button>

              <button
                type="button"
                onClick={handleQuickUserLogin}
                disabled={loading}
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100/80 active:bg-amber-200 text-amber-900 transition-all text-left"
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-amber-800">
                  <User className="w-3.5 h-3.5 text-amber-600" />
                  Login as User
                </div>
                <span className="text-[11px] text-amber-700 mt-0.5">Loan Management Only</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
