import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { Landmark, Shield, User, UserCheck, Users, Lock, ArrowRight, AlertCircle, Loader2, CheckCircle2, RefreshCw, Eye, EyeOff } from "lucide-react";

type BackendHealth = "checking" | "online" | "offline";

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [backendHealth, setBackendHealth] = useState<BackendHealth>("checking");

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const checkBackendHealth = useCallback(async () => {
    setBackendHealth("checking");
    try {
      const res = await axios.get("/api/health", { timeout: 3500 });
      if (res.status === 200 || res.status < 500) {
        setBackendHealth("online");
        return true;
      }
      setBackendHealth("offline");
      return false;
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      // Even if /api/health returned 404 on an older binary, the HTTP server is alive
      if (axiosErr?.response?.status && axiosErr.response.status < 500) {
        setBackendHealth("online");
        return true;
      }
      setBackendHealth("offline");
      return false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let timer: NodeJS.Timeout;

    const probe = async () => {
      const isReady = await checkBackendHealth();
      if (!isReady && isMounted) {
        // Retry polling every 2.5 seconds if server is still spinning up
        timer = setTimeout(probe, 2500);
      }
    };

    probe();

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [checkBackendHealth]);

  const handleLoginSubmit = async (e?: React.FormEvent, customUser?: string, customPass?: string) => {
    if (e) e.preventDefault();
    if (backendHealth !== "online") {
      await checkBackendHealth();
      return;
    }

    setError(null);
    setLoading(true);

    const userToLogin = customUser || username;
    const passToLogin = customPass || password;

    try {
      const loggedUser = await login(userToLogin, passToLogin);
      const origin = (location.state as { from?: { pathname: string } })?.from?.pathname;
      if (origin && origin !== "/login") {
        navigate(origin, { replace: true });
      } else if (loggedUser.role === "Admin" || loggedUser.role === "Member") {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/loans", { replace: true });
      }
    } catch (err: unknown) {
      const errorResponse = err as {
        response?: { status?: number; data?: { message?: string; detail?: string } };
      };
      const status = errorResponse?.response?.status;
      const serverMsg =
        errorResponse?.response?.data?.message || errorResponse?.response?.data?.detail;

      if (serverMsg) {
        setError(serverMsg);
      } else if (!status || status >= 500) {
        setBackendHealth("offline");
        setError(
          "Unable to reach the CoopIS Backend API (http://localhost:5208). Please ensure the API server is running."
        );
      } else {
        setError("Authentication failed. Please verify credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdminLogin = () => {
    if (backendHealth !== "online" || loading) return;
    setUsername("admin");
    setPassword("Admin123!");
    handleLoginSubmit(undefined, "admin", "Admin123!");
  };

  const handleQuickUserLogin = () => {
    if (backendHealth !== "online" || loading) return;
    setUsername("loanuser");
    setPassword("User123!");
    handleLoginSubmit(undefined, "loanuser", "User123!");
  };

  const handleQuickMemberLogin = () => {
    if (backendHealth !== "online" || loading) return;
    setUsername("member");
    setPassword("Member123!");
    handleLoginSubmit(undefined, "member", "Member123!");
  };

  const isInitializing = backendHealth === "checking";
  const isOffline = backendHealth === "offline";
  const isActionDisabled = loading || isInitializing || isOffline;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-500 mx-auto flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 mb-3 sm:mb-4">
          <Landmark className="w-8 h-8 sm:w-9 sm:h-9" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">CoopIS Portal</h2>
        <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-slate-300">
          Clean Architecture Cooperative Management System
        </p>

        {/* Backend & Database Readiness Indicator */}
        <div className="mt-3 flex items-center justify-center">
          {backendHealth === "checking" && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-300 text-xs font-medium animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>Initializing database & API connection...</span>
            </div>
          )}
          {backendHealth === "online" && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>System Online & Ready</span>
            </div>
          )}
          {backendHealth === "offline" && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-400/30 text-rose-300 text-xs font-medium">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Backend API Offline (http://localhost:5208)</span>
              <button
                type="button"
                onClick={() => checkBackendHealth()}
                className="ml-1 inline-flex items-center gap-1 underline hover:text-white cursor-pointer font-semibold"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 sm:mt-8 sm:mx-auto sm:w-full sm:max-w-md w-full">
        <div className="bg-white py-6 sm:py-8 px-4 sm:px-10 shadow-2xl rounded-2xl border border-slate-100">
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
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer transition-colors"
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isActionDisabled}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all shadow-md ${
                isActionDisabled
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed opacity-75 shadow-none"
                  : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-600/20 cursor-pointer"
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Authenticating...
                </>
              ) : isInitializing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                  Initializing Backend Engine...
                </>
              ) : isOffline ? (
                <>
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  Backend Offline — Click to Retry
                </>
              ) : (
                <>
                  Sign In to Account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Demo Quick-Login Buttons Section */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-center text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              One-Click Demo Credentials by Role
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={handleQuickAdminLogin}
                disabled={isActionDisabled}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${
                  isActionDisabled
                    ? "border-slate-200 bg-slate-50 text-slate-400 opacity-60 cursor-not-allowed"
                    : "border-purple-200 bg-purple-50/70 hover:bg-purple-100/80 active:bg-purple-200 text-purple-900 cursor-pointer"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Shield className={`w-3.5 h-3.5 ${isActionDisabled ? "text-slate-400" : "text-purple-600"}`} />
                  Admin
                </div>
                <span className="text-[11px] mt-0.5 text-purple-700/80">Full System Control</span>
              </button>

              <button
                type="button"
                onClick={handleQuickUserLogin}
                disabled={isActionDisabled}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${
                  isActionDisabled
                    ? "border-slate-200 bg-slate-50 text-slate-400 opacity-60 cursor-not-allowed"
                    : "border-blue-200 bg-blue-50/70 hover:bg-blue-100/80 active:bg-blue-200 text-blue-900 cursor-pointer"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <UserCheck className={`w-3.5 h-3.5 ${isActionDisabled ? "text-slate-400" : "text-blue-600"}`} />
                  Loan Officers
                </div>
                <span className="text-[11px] mt-0.5 text-blue-700/80">Loans & Repayments</span>
              </button>

              <button
                type="button"
                onClick={handleQuickMemberLogin}
                disabled={isActionDisabled}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${
                  isActionDisabled
                    ? "border-slate-200 bg-slate-50 text-slate-400 opacity-60 cursor-not-allowed"
                    : "border-sky-200 bg-sky-50/70 hover:bg-sky-100/80 active:bg-sky-200 text-sky-900 cursor-pointer"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Users className={`w-3.5 h-3.5 ${isActionDisabled ? "text-slate-400" : "text-sky-600"}`} />
                  Members
                </div>
                <span className="text-[11px] mt-0.5 text-sky-700/80">Self-Service Portal</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
