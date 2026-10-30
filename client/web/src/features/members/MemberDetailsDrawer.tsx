import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { memberService } from "../../services/memberService";
import { MemberDetail, MemberStatus } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/ui/Toast";
import {
  X,
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  Wallet,
  HandCoins,
  CheckCircle,
  AlertTriangle,
  Ban,
  Pencil,
  Clock,
  CreditCard,
  Loader2,
} from "lucide-react";

interface MemberDetailsDrawerProps {
  memberId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (member: MemberDetail) => void;
  onRequestDelete?: (member: MemberDetail) => void;
}

export const MemberDetailsDrawer: React.FC<MemberDetailsDrawerProps> = ({
  memberId,
  isOpen,
  onClose,
  onEdit,
  onRequestDelete,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"contributions" | "loans" | "profile">("contributions");

  const { data: member, isLoading, isError, error } = useQuery<MemberDetail>({
    queryKey: ["member-detail", memberId],
    queryFn: () => {
      if (!memberId) throw new Error("No member ID provided");
      return memberService.getMemberById(memberId);
    },
    enabled: !!memberId && isOpen,
  });

  const statusToggleMutation = useMutation({
    mutationFn: async ({ targetStatus }: { targetStatus: MemberStatus }) => {
      if (!memberId) return;
      return await memberService.updateMemberStatus(memberId, targetStatus);
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["member-detail", memberId] });
      if (updated) {
        showToast(
          "success",
          "Status Changed",
          `Member ${updated.memberCode} status changed to ${updated.status}`
        );
      }
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Failed to update member status.";
      showToast("error", "Status Update Failed", msg);
    },
  });

  if (!isOpen) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: MemberStatus) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Active
          </span>
        );
      case "INACTIVE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" /> Inactive
          </span>
        );
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <Ban className="w-3.5 h-3.5 text-rose-600" /> Suspended
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
        <div className="w-screen max-w-2xl bg-white shadow-2xl border-l border-slate-200 flex flex-col pointer-events-auto transform transition-transform duration-300 ease-in-out">
          {/* Header */}
          <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-lg">
                {member
                  ? `${member.firstName[0]}${member.lastName[0]}`.toUpperCase()
                  : <User className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    {member ? `${member.firstName} ${member.lastName}` : "Member Profile"}
                  </h3>
                  {member && getStatusBadge(member.status)}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span className="font-mono text-emerald-400 font-semibold">
                    {member?.memberCode}
                  </span>
                  <span>•</span>
                  <span>Member since {formatDate(member?.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && member && (
                <button
                  onClick={() => onEdit?.(member)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
                  title="Edit member information"
                >
                  <Pencil className="w-3.5 h-3.5 text-emerald-400" />
                  Edit
                </button>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-16 flex flex-col items-center justify-center text-slate-500 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                <span className="text-sm font-medium">Loading member ledger & profile...</span>
              </div>
            ) : isError || !member ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-slate-800">Error Loading Member</h4>
                <p className="text-xs text-slate-500 mt-1">
                  {(error as any)?.message || "Member details could not be retrieved."}
                </p>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold uppercase">
                      <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                      Share Capital
                    </div>
                    <div className="text-base font-bold text-slate-900 mt-1">
                      {formatCurrency(member.totalShareContributions)}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {member.totalContributionsCount} cutoffs recorded
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold uppercase">
                      <HandCoins className="w-3.5 h-3.5 text-sky-600" />
                      Active Loans
                    </div>
                    <div className="text-base font-bold text-slate-900 mt-1">
                      {member.activeLoansCount}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {member.activeLoansCount > 0 ? "Currently borrowing" : "No active loans"}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold uppercase">
                      <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                      Loan Balance
                    </div>
                    <div className="text-base font-bold text-slate-900 mt-1">
                      {formatCurrency(member.totalActiveLoanBalance)}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Principal unpaid
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold uppercase">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      Last Deposit
                    </div>
                    <div className="text-xs font-bold text-slate-900 mt-1.5 truncate">
                      {formatDate(member.lastContributionDate)}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Latest share entry
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div>
                  <div className="flex border-b border-slate-200">
                    <button
                      onClick={() => setActiveTab("contributions")}
                      className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                        activeTab === "contributions"
                          ? "border-emerald-600 text-emerald-700"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Wallet className="w-4 h-4" />
                      Share Contributions ({member.contributions.length})
                    </button>
                    <button
                      onClick={() => setActiveTab("loans")}
                      className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                        activeTab === "loans"
                          ? "border-emerald-600 text-emerald-700"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <HandCoins className="w-4 h-4" />
                      Loans & Portfolio ({member.loans.length})
                    </button>
                    <button
                      onClick={() => setActiveTab("profile")}
                      className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                        activeTab === "profile"
                          ? "border-emerald-600 text-emerald-700"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <User className="w-4 h-4" />
                      Contact & Account
                    </button>
                  </div>
                </div>

                {/* Tab 1: Contributions History */}
                {activeTab === "contributions" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Historical Share Deposits
                      </h4>
                      <span className="text-xs font-semibold text-emerald-700">
                        Total: {formatCurrency(member.totalShareContributions)}
                      </span>
                    </div>

                    {member.contributions.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                        No share capital contributions have been recorded yet for this member.
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 font-semibold text-slate-600 uppercase border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3">Cutoff Period</th>
                              <th className="py-2.5 px-3">Cutoff Date</th>
                              <th className="py-2.5 px-3">Channel</th>
                              <th className="py-2.5 px-3 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {member.contributions.map((c) => (
                              <tr key={c.id} className="hover:bg-slate-50/70">
                                <td className="py-2.5 px-3 font-semibold text-slate-900">
                                  {c.cutoffLabel}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {formatDate(c.cutoffDate)}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-medium uppercase text-slate-700">
                                    {c.paymentChannel.replace("_", " ")}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                  {formatCurrency(c.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Loans Portfolio */}
                {activeTab === "loans" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Loan Accounts & Repayment Standing
                      </h4>
                      <span className="text-xs font-semibold text-sky-700">
                        Active Balance: {formatCurrency(member.totalActiveLoanBalance)}
                      </span>
                    </div>

                    {member.loans.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                        No loans originated or applied by this member.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {member.loans.map((loan) => {
                          const isFullyPaid = loan.status === "PAID";
                          const isActive = loan.status === "ACTIVE";

                          return (
                            <div
                              key={loan.id}
                              className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors shadow-2xs space-y-2.5"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-slate-900">
                                    {loan.loanReference}
                                  </span>
                                  <span className="text-[11px] text-slate-500">
                                    ({loan.termMonths} mos / {loan.cutoffsCount} cutoffs)
                                  </span>
                                </div>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                    isActive
                                      ? "bg-emerald-100 text-emerald-800"
                                      : isFullyPaid
                                      ? "bg-slate-100 text-slate-700"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {loan.status}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
                                <div>
                                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                                    Principal
                                  </span>
                                  <div className="font-semibold text-slate-800">
                                    {formatCurrency(loan.principalAmount)}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                                    Interest Rate
                                  </span>
                                  <div className="font-semibold text-slate-800">
                                    {(loan.interestRate * 100).toFixed(2)}%
                                  </div>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                                    Principal Paid
                                  </span>
                                  <div className="font-semibold text-emerald-700">
                                    {formatCurrency(loan.principalPaid)}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                                    Remaining
                                  </span>
                                  <div className="font-bold text-slate-900">
                                    {formatCurrency(loan.remainingBalance)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Contact & Account Profile */}
                {activeTab === "profile" && (
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <span className="font-semibold text-slate-500 uppercase">Primary Email</span>
                        <div className="flex items-center gap-1.5 font-medium text-slate-900">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {member.email}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <span className="font-semibold text-slate-500 uppercase">Contact Phone</span>
                        <div className="flex items-center gap-1.5 font-medium text-slate-900">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {member.phone || "No phone provided"}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <span className="font-semibold text-slate-500 uppercase">Member Code</span>
                        <span className="font-mono font-bold text-emerald-700">
                          {member.memberCode}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <span className="font-semibold text-slate-500 uppercase">Registered Date</span>
                        <span className="text-slate-800">{formatDate(member.createdAt)}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-500 uppercase">Last Profile Update</span>
                        <span className="text-slate-800">{formatDate(member.updatedAt)}</span>
                      </div>
                    </div>

                    {/* Admin Status Management */}
                    {isAdmin && (
                      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
                          <Shield className="w-4 h-4 text-amber-700" />
                          Administrative Account Controls
                        </div>
                        <p className="text-xs text-amber-800 leading-relaxed">
                          Admins can toggle membership status between Active, Inactive, and Suspended.
                          Members holding active loan balances cannot be suspended or deactivated.
                        </p>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {member.status !== "ACTIVE" && (
                            <button
                              disabled={statusToggleMutation.isPending}
                              onClick={() => statusToggleMutation.mutate({ targetStatus: "ACTIVE" })}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Reactivate Member
                            </button>
                          )}

                          {member.status !== "INACTIVE" && (
                            <button
                              disabled={statusToggleMutation.isPending}
                              onClick={() => statusToggleMutation.mutate({ targetStatus: "INACTIVE" })}
                              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              Set as Inactive
                            </button>
                          )}

                          {member.status !== "SUSPENDED" && (
                            <button
                              disabled={statusToggleMutation.isPending}
                              onClick={() => statusToggleMutation.mutate({ targetStatus: "SUSPENDED" })}
                              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              Suspend Member
                            </button>
                          )}

                          <button
                            onClick={() => onRequestDelete?.(member)}
                            className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-colors ml-auto"
                          >
                            Delete / Suspend Dialog
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Cooperative Member ID: <span className="font-mono">{member?.id}</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
