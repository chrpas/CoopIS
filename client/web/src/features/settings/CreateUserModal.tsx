import React, { useState, useMemo } from "react";
import {
  X,
  UserPlus,
  ShieldAlert,
  ShieldCheck,
  User,
  KeyRound,
  Mail,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { UserRole, CreateUserPayload } from "../../types";

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateUserPayload) => Promise<void>;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole>("User");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password strength calculation
  const passwordCriteria = useMemo(() => {
    return {
      minLength: password.length >= 6,
      hasLetter: /[a-zA-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[^a-zA-Z0-9]/.test(password),
    };
  }, [password]);

  const strengthScore = useMemo(() => {
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (passwordCriteria.hasLetter) score++;
    if (passwordCriteria.hasNumber) score++;
    if (passwordCriteria.hasSpecial) score++;
    return score;
  }, [password, passwordCriteria]);

  const strengthLabel = useMemo(() => {
    if (password.length === 0) return { text: "None", color: "bg-slate-200", textColor: "text-slate-400" };
    if (strengthScore <= 2) return { text: "Weak", color: "bg-rose-500", textColor: "text-rose-600" };
    if (strengthScore <= 4) return { text: "Moderate", color: "bg-amber-500", textColor: "text-amber-600" };
    return { text: "Strong", color: "bg-emerald-500", textColor: "text-emerald-600" };
  }, [password, strengthScore]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || username.trim().length < 3) {
      setError("Username must be at least 3 characters long.");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setError("Please provide a valid email address.");
      return;
    }

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        username: username.trim(),
        email: email.trim(),
        password,
        role,
      });
      // Reset form
      setUsername("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setRole("User");
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message || "Failed to create user.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Create Operator Account</h3>
              <p className="text-xs text-slate-500">Register a new system user with assigned role & credentials</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />
            <div>
              <div className="font-semibold">Validation Error</div>
              <div>{error}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Username <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. loan_officer_santos"
                className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-medium text-slate-900"
                required
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Alphanumeric characters, underscores, and dots only.</p>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@coopis.org"
                className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-medium text-slate-900"
                required
              />
            </div>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Access Role <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setRole("User")}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  role === "User"
                    ? "bg-blue-50/60 border-blue-500 ring-2 ring-blue-500/20 shadow-xs"
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <User className={`w-4 h-4 ${role === "User" ? "text-blue-600" : "text-slate-400"}`} />
                  <span className={`text-sm font-bold ${role === "User" ? "text-blue-900" : "text-slate-700"}`}>
                    Loan Officer (User)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Can view members & process loan repayments/applications.
                </p>
              </div>

              <div
                onClick={() => setRole("Admin")}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  role === "Admin"
                    ? "bg-emerald-50/60 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className={`w-4 h-4 ${role === "Admin" ? "text-emerald-600" : "text-slate-400"}`} />
                  <span className={`text-sm font-bold ${role === "Admin" ? "text-emerald-900" : "text-slate-700"}`}>
                    Administrator
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Full control over accounting, distribution, settings & operators.
                </p>
              </div>
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-medium text-slate-900"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password strength indicator */}
            {password.length > 0 && (
              <div className="mt-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between text-[11px] mb-1.5 font-medium">
                  <span className="text-slate-600">Password Strength:</span>
                  <span className={`font-bold ${strengthLabel.textColor}`}>{strengthLabel.text}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden flex gap-1">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      strengthScore >= 1 ? strengthLabel.color : "bg-transparent"
                    }`}
                    style={{ width: "25%" }}
                  />
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      strengthScore >= 3 ? strengthLabel.color : "bg-transparent"
                    }`}
                    style={{ width: "25%" }}
                  />
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      strengthScore >= 4 ? strengthLabel.color : "bg-transparent"
                    }`}
                    style={{ width: "25%" }}
                  />
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      strengthScore >= 5 ? strengthLabel.color : "bg-transparent"
                    }`}
                    style={{ width: "25%" }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-2 text-[10px] text-slate-500">
                  <span className={`flex items-center gap-1 ${passwordCriteria.minLength ? "text-emerald-600 font-semibold" : ""}`}>
                    <CheckCircle2 className="w-3 h-3" /> Min. 6 characters
                  </span>
                  <span className={`flex items-center gap-1 ${passwordCriteria.hasLetter ? "text-emerald-600 font-semibold" : ""}`}>
                    <CheckCircle2 className="w-3 h-3" /> Letters (a-z, A-Z)
                  </span>
                  <span className={`flex items-center gap-1 ${passwordCriteria.hasNumber ? "text-emerald-600 font-semibold" : ""}`}>
                    <CheckCircle2 className="w-3 h-3" /> Numbers (0-9)
                  </span>
                  <span className={`flex items-center gap-1 ${passwordCriteria.hasSpecial ? "text-emerald-600 font-semibold" : ""}`}>
                    <CheckCircle2 className="w-3 h-3" /> Special symbols
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Confirm Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full pl-9 pr-10 py-2.5 text-sm bg-slate-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium text-slate-900 ${
                  confirmPassword && confirmPassword !== password
                    ? "border-rose-300 focus:border-rose-500"
                    : "border-slate-200 focus:border-emerald-600"
                }`}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && confirmPassword !== password && (
              <p className="text-[11px] text-rose-500 mt-1 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" /> Passwords do not match.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (confirmPassword.length > 0 && confirmPassword !== password)}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating Operator...
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  Save Operator Account
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
