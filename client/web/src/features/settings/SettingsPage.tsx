import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Sliders,
  Settings as SettingsIcon,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Lock,
  Trash2,
  RefreshCw,
  Landmark,
  Percent,
  Layers,
  Shield,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { UserAccount, UserRole, CreateUserPayload } from "../../types";
import { userService } from "../../services/userService";
import { CreateUserModal } from "./CreateUserModal";

type SettingsTab = "users" | "general" | "security";

export const SettingsPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>("users");

  // User management state
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modals & Action states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserAccount | null>(null);
  const [roleChangeUser, setRoleChangeUser] = useState<UserAccount | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Load users
  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await userService.getUsers();
      setUsers(data);
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.response?.data?.detail || "Failed to load system user accounts.",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Dismiss feedback after 5s
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && u.isActive) ||
        (statusFilter === "INACTIVE" && !u.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Metrics
  const metrics = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const admins = users.filter((u) => u.role === "Admin").length;
    const standardUsers = users.filter((u) => u.role === "User").length;
    return { total, active, admins, standardUsers };
  }, [users]);

  // Toggle active status
  const handleToggleActive = async (userItem: UserAccount) => {
    if (userItem.username.toLowerCase() === "admin") {
      setFeedback({
        type: "error",
        message: "The primary 'admin' system account cannot be disabled.",
      });
      return;
    }

    if (userItem.id === currentUser?.id) {
      setFeedback({
        type: "error",
        message: "You cannot disable your own active administrator account.",
      });
      return;
    }

    const nextStatus = !userItem.isActive;

    try {
      setUpdatingUserId(userItem.id);
      const updated = await userService.updateUserRoleOrStatus(userItem.id, {
        isActive: nextStatus,
      });

      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setFeedback({
        type: "success",
        message: `Account '${userItem.username}' ${nextStatus ? "activated" : "deactivated"} successfully.`,
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.response?.data?.detail || err.message || "Failed to update account status.",
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Change user role
  const handleRoleChange = async (userItem: UserAccount, newRole: UserRole) => {
    if (userItem.role === newRole) {
      setRoleChangeUser(null);
      return;
    }

    if (userItem.username.toLowerCase() === "admin" && newRole !== "Admin") {
      setFeedback({
        type: "error",
        message: "The primary 'admin' account cannot be demoted from Administrator.",
      });
      setRoleChangeUser(null);
      return;
    }

    if (userItem.id === currentUser?.id && newRole !== "Admin") {
      setFeedback({
        type: "error",
        message: "You cannot remove your own Administrator privileges.",
      });
      setRoleChangeUser(null);
      return;
    }

    try {
      setUpdatingUserId(userItem.id);
      const updated = await userService.updateUserRoleOrStatus(userItem.id, {
        role: newRole,
      });

      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setFeedback({
        type: "success",
        message: `User '${userItem.username}' role changed to ${newRole}.`,
      });
      setRoleChangeUser(null);
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.response?.data?.detail || err.message || "Failed to update user role.",
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Delete / Remove user
  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    try {
      setUpdatingUserId(deletingUser.id);
      await userService.deleteOrDeactivateUser(deletingUser.id);
      setFeedback({
        type: "success",
        message: `Operator account '${deletingUser.username}' processed successfully.`,
      });
      setDeletingUser(null);
      await loadUsers();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.response?.data?.detail || err.message || "Failed to delete user.",
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Create user callback
  const handleCreateUser = async (payload: CreateUserPayload) => {
    const newUser = await userService.createUser(payload);
    setUsers((prev) => [newUser, ...prev]);
    setFeedback({
      type: "success",
      message: `Operator account '${newUser.username}' created successfully!`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center shadow-md">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">System Administration & Settings</h1>
              <p className="text-xs text-slate-500">
                Manage operator accounts, security policies, and financial engine rules
              </p>
            </div>
          </div>
        </div>

        {activeTab === "users" && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create New Operator</span>
          </button>
        )}
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs shadow-xs animate-in fade-in duration-200 ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 font-bold text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Settings Navigation Tabs */}
      <div className="border-b border-slate-200 flex gap-2">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
            activeTab === "users"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Access Management</span>
          <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
            activeTab === "general"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>General & Financial Policy</span>
        </button>

        <button
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
            activeTab === "security"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Permissions Matrix</span>
        </button>
      </div>

      {/* TAB 1: USER ACCESS MANAGEMENT */}
      {activeTab === "users" && (
        <div className="space-y-6">
          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Operators</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.total}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Registered accounts</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Operators</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{metrics.active}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Can login to system</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Administrators</p>
                <p className="text-2xl font-bold text-purple-700 mt-1">{metrics.admins}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Full financial authority</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Loan Officers (Users)</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{metrics.standardUsers}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Front-line operations</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search operators by username or email..."
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-medium text-slate-900"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                <Filter className="w-3.5 h-3.5" />
                <span>Filters:</span>
              </div>

              {/* Role filter */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-semibold text-slate-700"
              >
                <option value="ALL">All Roles</option>
                <option value="Admin">Administrator</option>
                <option value="User">Loan Officer</option>
              </select>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-semibold text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>

              <button
                onClick={loadUsers}
                title="Refresh users"
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-emerald-600" : ""}`} />
              </button>
            </div>
          </div>

          {/* User Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Operator / Account</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Assigned Role</th>
                    <th className="py-3 px-4">Access Status</th>
                    <th className="py-3 px-4">Date Registered</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {isLoading && users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                          <span>Loading operator accounts...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No operator accounts found matching your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((item) => {
                      const isPrimaryAdmin = item.username.toLowerCase() === "admin";
                      const isSelf = item.id === currentUser?.id;
                      const isUpdating = updatingUserId === item.id;

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/60 transition-colors ${
                            !item.isActive ? "bg-slate-50/40 text-slate-400" : ""
                          }`}
                        >
                          {/* User / Initial Avatar */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold border shadow-xs ${
                                  item.role === "Admin"
                                    ? "bg-purple-100 text-purple-700 border-purple-200"
                                    : "bg-blue-100 text-blue-700 border-blue-200"
                                }`}
                              >
                                {item.username.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 flex items-center gap-2">
                                  <span>{item.username}</span>
                                  {isPrimaryAdmin && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                                      <Lock className="w-2.5 h-2.5" /> Primary Root
                                    </span>
                                  )}
                                  {isSelf && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      You
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  ID: {item.id.slice(0, 8)}...
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="py-3 px-4 text-slate-700 font-medium">
                            {item.email}
                          </td>

                          {/* Role Badge & Quick Change */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {item.role === "Admin" ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                  <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                                  Administrator
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                                  Loan Officer (User)
                                </span>
                              )}

                              {!isPrimaryAdmin && !isSelf && (
                                <button
                                  onClick={() => setRoleChangeUser(item)}
                                  className="text-[10px] font-semibold text-slate-400 hover:text-emerald-600 underline underline-offset-2"
                                >
                                  Change
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Interactive Active Toggle Switch */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={isPrimaryAdmin || isSelf || isUpdating}
                                onClick={() => handleToggleActive(item)}
                                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  item.isActive ? "bg-emerald-600" : "bg-slate-300"
                                } ${isPrimaryAdmin || isSelf ? "opacity-60 cursor-not-allowed" : ""}`}
                                title={
                                  isPrimaryAdmin
                                    ? "Primary root admin cannot be disabled"
                                    : isSelf
                                    ? "You cannot disable your own active account"
                                    : item.isActive
                                    ? "Click to deactivate operator access"
                                    : "Click to activate operator access"
                                }
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                    item.isActive ? "translate-x-5" : "translate-x-0"
                                  }`}
                                />
                              </button>
                              <span
                                className={`text-[11px] font-bold ${
                                  item.isActive ? "text-emerald-700" : "text-slate-400"
                                }`}
                              >
                                {item.isActive ? "Active" : "Disabled"}
                              </span>
                            </div>
                          </td>

                          {/* CreatedAt */}
                          <td className="py-3 px-4 text-slate-500 font-medium text-[11px]">
                            {new Date(item.createdAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isPrimaryAdmin && !isSelf ? (
                                <button
                                  onClick={() => setDeletingUser(item)}
                                  disabled={isUpdating}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Deactivate or Remove User"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <span
                                  className="p-1.5 text-slate-300 cursor-not-allowed"
                                  title="Protected account"
                                >
                                  <Lock className="w-4 h-4" />
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GENERAL & FINANCIAL POLICY */}
      {activeTab === "general" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cooperative Profile Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Cooperative Identity</h3>
                  <p className="text-xs text-slate-500">Official registry & fiscal governance</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Platform Name</span>
                  <span className="text-slate-800 font-bold text-sm">CoopIS Enterprise</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Fiscal Year</span>
                  <span className="text-slate-800 font-bold text-sm">FY-2026 (Active)</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Cutoff Schedule</span>
                  <span className="text-slate-800 font-bold text-sm">24 Semi-Monthly Cutoffs</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Architecture Style</span>
                  <span className="text-slate-800 font-bold text-sm">Clean Arch + .NET 8</span>
                </div>
              </div>
            </div>

            {/* Loan Engine Policy Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Percent className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Loan & Penalty Policies</h3>
                  <p className="text-xs text-slate-500">Rules applied in Amortization Engine</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <span className="font-bold text-slate-800 block">Cutoff Payment Grace Period</span>
                    <span className="text-[11px] text-slate-500">Grace period granted before late surcharge accrues</span>
                  </div>
                  <span className="font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200">
                    3 Calendar Days
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <span className="font-bold text-slate-800 block">Late Penalty Charge Rate</span>
                    <span className="text-[11px] text-slate-500">Assessed on overdue unpaid principal balance</span>
                  </div>
                  <span className="font-bold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 border border-amber-200">
                    2.0% Monthly (₱)
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <span className="font-bold text-slate-800 block">Standard Loan Interest</span>
                    <span className="text-[11px] text-slate-500">Flat upfront origination interest rate</span>
                  </div>
                  <span className="font-bold px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 border border-blue-200">
                    5.0% Flat
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Surplus Distribution Formula Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Annual Surplus Distribution Weights</h3>
                <p className="text-xs text-slate-500">Mandated statutory dividend allocation parameters</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-purple-900 text-sm">General Dividend</span>
                  <span className="text-base font-bold text-purple-700">65%</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Allocated proportionally to members based on cumulative share contributions and member equity.
                </p>
              </div>

              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-blue-900 text-sm">Patronage Refund</span>
                  <span className="text-base font-bold text-blue-700">30%</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Distributed to borrowing members based on actual interest paid and loan volume utilization.
                </p>
              </div>

              <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-amber-900 text-sm">Management & Reserve</span>
                  <span className="text-base font-bold text-amber-700">5%</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Retained by the cooperative board for operational reserves, risk buffer, and administrative overhead.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PERMISSIONS MATRIX */}
      {activeTab === "security" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Role-Based Access Control (RBAC) Matrix</h3>
              <p className="text-xs text-slate-500">
                Comparison of functional capabilities between the Administrator and Loan Officer (User) roles
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-6">System Module</th>
                    <th className="py-3 px-4">Capability / Scope</th>
                    <th className="py-3 px-4 text-center">Administrator</th>
                    <th className="py-3 px-4 text-center">Loan Officer (User)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-3.5 px-6 font-bold text-slate-900">Executive Dashboard</td>
                    <td className="py-3.5 px-4 text-slate-600">Portfolio metrics, fund charts, cash flows</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                        <CheckCircle2 className="w-4 h-4" /> Full Access
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-slate-400 font-semibold">
                        ✕ Restricted
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3.5 px-6 font-bold text-slate-900">Member Registry</td>
                    <td className="py-3.5 px-4 text-slate-600">Member directory, CRUD profiles, status updates</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                        <CheckCircle2 className="w-4 h-4" /> Full CRUD
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-blue-600 font-semibold">
                        <UserCheck className="w-3.5 h-3.5" /> Read-Only Directory
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3.5 px-6 font-bold text-slate-900">Share Contributions</td>
                    <td className="py-3.5 px-4 text-slate-600">Log cutoff capital share, cash & payroll deductions</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                        <CheckCircle2 className="w-4 h-4" /> Full Control
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-slate-400 font-semibold">
                        ✕ Restricted
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3.5 px-6 font-bold text-slate-900">Loan & Repayment Engine</td>
                    <td className="py-3.5 px-4 text-slate-600">Originate loans, log cutoff payments, apply late penalties</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                        <CheckCircle2 className="w-4 h-4" /> Full Control
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                        <CheckCircle2 className="w-4 h-4" /> Process Repayments
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3.5 px-6 font-bold text-slate-900">Accounting & Fund Reconciliation</td>
                    <td className="py-3.5 px-4 text-slate-600">Balance sheet, formula validation, bank statement uploads</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                        <CheckCircle2 className="w-4 h-4" /> Full Control
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-slate-400 font-semibold">
                        ✕ Restricted
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3.5 px-6 font-bold text-slate-900">Surplus Distribution</td>
                    <td className="py-3.5 px-4 text-slate-600">Execute year-end dividend allocation runs, export ledgers</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                        <CheckCircle2 className="w-4 h-4" /> Finalize Runs
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-slate-400 font-semibold">
                        ✕ Restricted
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3.5 px-6 font-bold text-slate-900">Settings & Operator Accounts</td>
                    <td className="py-3.5 px-4 text-slate-600">Manage users, promote roles, enable/disable access</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                        <CheckCircle2 className="w-4 h-4" /> Master Admin
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-slate-400 font-semibold">
                        ✕ Restricted
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE USER MODAL */}
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateUser}
      />

      {/* CHANGE ROLE DIALOG */}
      {roleChangeUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Change Operator Role</h3>
            <p className="text-xs text-slate-500 mb-4">
              Select access tier for account <span className="font-bold text-slate-800">@{roleChangeUser.username}</span>
            </p>

            <div className="space-y-2 mb-5">
              <button
                type="button"
                onClick={() => handleRoleChange(roleChangeUser, "User")}
                className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-all ${
                  roleChangeUser.role === "User"
                    ? "bg-blue-50 border-blue-500 ring-2 ring-blue-500/20"
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-slate-900">Loan Officer (User)</div>
                  <div className="text-[11px] text-slate-500">Access to members and loans</div>
                </div>
                {roleChangeUser.role === "User" && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange(roleChangeUser, "Admin")}
                className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-all ${
                  roleChangeUser.role === "Admin"
                    ? "bg-purple-50 border-purple-500 ring-2 ring-purple-500/20"
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-slate-900">Administrator</div>
                  <div className="text-[11px] text-slate-500">Full control over accounting and users</div>
                </div>
                {roleChangeUser.role === "Admin" && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
              </button>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRoleChangeUser(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE / DEACTIVATE CONFIRMATION DIALOG */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Remove or Deactivate Account</h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Are you sure you want to deactivate or remove operator account{" "}
              <span className="font-bold text-slate-800">@{deletingUser.username}</span>? If the user has
              associated records, the account will be safely disabled.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={updatingUserId === deletingUser.id}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                {updatingUserId === deletingUser.id ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Confirm Action
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
