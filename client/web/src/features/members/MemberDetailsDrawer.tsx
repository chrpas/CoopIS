import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { memberService } from "../../services/memberService";
import {
  MemberDetail,
  MemberStatus,
  CutoffPeriod,
  FinancialPolicyResponse,
  MemberContributionItem,
} from "../../types";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { TablePagination, DEFAULT_PAGE_SIZE } from "../../components/ui/TablePagination";
import {
  X,
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  Wallet,
  CheckCircle,
  AlertTriangle,
  Ban,
  Pencil,
  Clock,
  TrendingUp,
  Layers,
  Loader2,
  Coins,
} from "lucide-react";

interface MemberDetailsDrawerProps {
  memberId: string | null;
  isOpen: boolean;
  onClose: () => void;
  mode?: "contributions" | "profile";
  onEdit?: (member: MemberDetail) => void;
  onRequestDelete?: (member: MemberDetail) => void;
}

export const MemberDetailsDrawer: React.FC<MemberDetailsDrawerProps> = ({
  memberId,
  isOpen,
  onClose,
  mode = "contributions",
  onEdit,
  onRequestDelete,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [contribPage, setContribPage] = useState<number>(1);
  const [contribPageSize, setContribPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number | null>(null);
  const [cutoffFilter, setCutoffFilter] = useState<"all" | "contributed" | "delayed">("all");

  const { data: member, isLoading, isError, error } = useQuery<MemberDetail>({
    queryKey: ["member-detail", memberId],
    queryFn: () => {
      if (!memberId) throw new Error("No member ID provided");
      return memberService.getMemberById(memberId);
    },
    enabled: !!memberId && isOpen,
  });

  const { data: cutoffs = [] } = useQuery<CutoffPeriod[]>({
    queryKey: ["cutoff-periods"],
    queryFn: async () => {
      const res = await api.get<CutoffPeriod[]>("/cutoff-periods");
      return res.data;
    },
    enabled: isOpen && mode === "contributions",
  });

  const { data: financialPolicy } = useQuery<FinancialPolicyResponse>({
    queryKey: ["financial-policy"],
    queryFn: async () => {
      const res = await api.get<FinancialPolicyResponse>("/settings/financial-policy");
      return res.data;
    },
    enabled: isOpen && mode === "contributions",
  });

  const contributionGraceDays =
    financialPolicy?.activeLoanPolicy.contributionGracePeriodDays ?? 5;
  const loanGraceDays = financialPolicy?.activeLoanPolicy.gracePeriodDays ?? 14;
  const latePenaltyRatePercent =
    financialPolicy?.activeLoanPolicy.latePenaltyRatePercent ?? 5.0;
  const penaltyRate = latePenaltyRatePercent / 100;

  const availableFiscalYears = useMemo(() => {
    const years = Array.from(new Set(cutoffs.map((c) => c.fiscalYear)));
    return years.sort((a, b) => b - a);
  }, [cutoffs]);

  useEffect(() => {
    if (availableFiscalYears.length > 0 && selectedFiscalYear === null) {
      setSelectedFiscalYear(availableFiscalYears[0]);
    }
  }, [availableFiscalYears, selectedFiscalYear]);

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

  const avgContribution =
    member && member.totalContributionsCount > 0
      ? member.totalShareContributions / member.totalContributionsCount
      : 0;

  const expectedPerCutoff = avgContribution > 0 ? avgContribution : 2000;

  // Build full cutoff schedule with contribution indicator & 5-day grace penalty evaluation
  const cutoffScheduleRows = useMemo(() => {
    if (!member) return [];

    const byCutoffId = new Map<string, MemberContributionItem>();
    const byCutoffLabel = new Map<string, MemberContributionItem>();
    member.contributions.forEach((c) => {
      if (c.cutoffId) byCutoffId.set(c.cutoffId, c);
      if (c.cutoffLabel) byCutoffLabel.set(c.cutoffLabel, c);
    });

    const targetCutoffs = cutoffs
      .filter((c) => !selectedFiscalYear || c.fiscalYear === selectedFiscalYear)
      .sort(
        (a, b) => new Date(a.cutoffDate).getTime() - new Date(b.cutoffDate).getTime()
      );

    // Fallback if cutoff periods haven't loaded yet: build rows from member.contributions
    if (targetCutoffs.length === 0) {
      return member.contributions.map((c, idx) => {
        const cDate = new Date(c.cutoffDate);
        const graceDeadline = new Date(cDate);
        graceDeadline.setDate(graceDeadline.getDate() + contributionGraceDays);
        graceDeadline.setHours(23, 59, 59, 999);
        const recDate = c.createdAt ? new Date(c.createdAt) : null;
        const isLate = Boolean(recDate && recDate > graceDeadline);
        const daysLate =
          isLate && recDate
            ? Math.max(
                1,
                Math.floor((recDate.getTime() - cDate.getTime()) / (1000 * 60 * 60 * 24))
              )
            : 0;
        const penalty = isLate
          ? Math.round((Number(c.amount) || 0) * penaltyRate * 100) / 100
          : 0;

        return {
          key: c.id || String(idx),
          cutoffNumber: idx + 1,
          cutoffId: c.cutoffId,
          cutoffLabel: c.cutoffLabel,
          cutoffDate: c.cutoffDate,
          graceDeadlineIso: graceDeadline.toISOString(),
          hasContributed: (Number(c.amount) || 0) > 0,
          amount: Number(c.amount) || 0,
          paymentChannel: c.paymentChannel,
          recordedAt: c.createdAt,
          status: isLate ? ("CONTRIBUTED_LATE" as const) : ("CONTRIBUTED" as const),
          daysLate,
          penaltyAmount: penalty,
        };
      });
    }

    const now = new Date();
    return targetCutoffs.map((cutoff, idx) => {
      const contrib =
        byCutoffId.get(cutoff.id) || byCutoffLabel.get(cutoff.label) || null;
      const amount = Number(contrib?.amount) || 0;
      const hasContributed = amount > 0;

      const cDate = new Date(cutoff.cutoffDate);
      const graceDeadline = new Date(cDate);
      graceDeadline.setDate(graceDeadline.getDate() + contributionGraceDays);
      graceDeadline.setHours(23, 59, 59, 999);

      const recDate = contrib?.createdAt ? new Date(contrib.createdAt) : null;

      let status:
        | "CONTRIBUTED"
        | "CONTRIBUTED_LATE"
        | "OVERDUE"
        | "GRACE_PERIOD"
        | "UPCOMING" = "UPCOMING";
      let daysLate = 0;
      let penaltyAmount = 0;

      if (hasContributed) {
        if (recDate && recDate > graceDeadline) {
          status = "CONTRIBUTED_LATE";
          daysLate = Math.max(
            1,
            Math.floor((recDate.getTime() - cDate.getTime()) / (1000 * 60 * 60 * 24))
          );
          penaltyAmount = Math.round(amount * penaltyRate * 100) / 100;
        } else {
          status = "CONTRIBUTED";
        }
      } else {
        if (now > graceDeadline) {
          status = "OVERDUE";
          daysLate = Math.max(
            1,
            Math.floor((now.getTime() - cDate.getTime()) / (1000 * 60 * 60 * 24))
          );
          penaltyAmount = Math.round(expectedPerCutoff * penaltyRate * 100) / 100;
        } else if (now >= cDate && now <= graceDeadline) {
          status = "GRACE_PERIOD";
        } else {
          status = "UPCOMING";
        }
      }

      return {
        key: cutoff.id,
        cutoffNumber: idx + 1,
        cutoffId: cutoff.id,
        cutoffLabel: cutoff.label,
        cutoffDate: cutoff.cutoffDate,
        graceDeadlineIso: graceDeadline.toISOString(),
        hasContributed,
        amount,
        paymentChannel: contrib?.paymentChannel || null,
        recordedAt: contrib?.createdAt || null,
        status,
        daysLate,
        penaltyAmount,
      };
    });
  }, [
    member,
    cutoffs,
    selectedFiscalYear,
    contributionGraceDays,
    penaltyRate,
    expectedPerCutoff,
  ]);

  const contributedRowsCount = useMemo(
    () => cutoffScheduleRows.filter((r) => r.hasContributed).length,
    [cutoffScheduleRows]
  );

  const delayedOrOverdueRowsCount = useMemo(
    () =>
      cutoffScheduleRows.filter(
        (r) => r.status === "OVERDUE" || r.status === "CONTRIBUTED_LATE"
      ).length,
    [cutoffScheduleRows]
  );

  const totalContributionPenalties = useMemo(
    () =>
      cutoffScheduleRows.reduce((sum, r) => sum + (Number(r.penaltyAmount) || 0), 0),
    [cutoffScheduleRows]
  );

  const filteredScheduleRows = useMemo(() => {
    if (cutoffFilter === "contributed") {
      return cutoffScheduleRows.filter((r) => r.hasContributed);
    }
    if (cutoffFilter === "delayed") {
      return cutoffScheduleRows.filter(
        (r) => r.status === "OVERDUE" || r.status === "CONTRIBUTED_LATE"
      );
    }
    return cutoffScheduleRows;
  }, [cutoffScheduleRows, cutoffFilter]);

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

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10 pointer-events-none">
        <div className="w-screen max-w-2xl bg-white shadow-2xl border-l border-slate-200 flex flex-col pointer-events-auto transform transition-transform duration-300 ease-in-out">
          {/* Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
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
                  <span>
                    {mode === "contributions"
                      ? "Share Capital Statement & History"
                      : `Member since ${formatDate(member?.createdAt)}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {mode === "profile" && isAdmin && member && onEdit && (
                <button
                  onClick={() => onEdit(member)}
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
                <span className="text-sm font-medium">Loading member statement...</span>
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
            ) : mode === "contributions" ? (
              /* SHARE CONTRIBUTIONS STATEMENT & HISTORY VIEW */
              <div className="p-6 space-y-6">
                {/* Share Contribution Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
                    <div className="flex items-center gap-1.5 text-emerald-800 text-[11px] font-semibold uppercase">
                      <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                      Share Capital
                    </div>
                    <div className="text-base font-bold text-emerald-950 mt-1 font-mono">
                      {formatCurrency(member.totalShareContributions)}
                    </div>
                    <div className="text-[10px] text-emerald-700 mt-0.5">
                      Accumulated equity
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold uppercase">
                      <Layers className="w-3.5 h-3.5 text-sky-600" />
                      Cutoffs Contributed
                    </div>
                    <div className="text-base font-bold text-slate-900 mt-1 font-mono">
                      {contributedRowsCount} / {cutoffScheduleRows.length || 24}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      FY {selectedFiscalYear ?? new Date().getFullYear()} coverage
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold uppercase">
                      <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                      Avg / Cutoff
                    </div>
                    <div className="text-base font-bold text-slate-900 mt-1 font-mono">
                      {formatCurrency(avgContribution)}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Per remitted cutoff
                    </div>
                  </div>

                  <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200">
                    <div className="flex items-center gap-1.5 text-amber-900 text-[11px] font-semibold uppercase">
                      <Coins className="w-3.5 h-3.5 text-amber-600" />
                      Late Penalties
                    </div>
                    <div className="text-base font-bold text-amber-950 mt-1 font-mono">
                      {formatCurrency(totalContributionPenalties)}
                    </div>
                    <div className="text-[10px] text-amber-800 mt-0.5">
                      {contributionGraceDays}d grace • {latePenaltyRatePercent}% rate
                    </div>
                  </div>
                </div>

                {/* Grace Period & Late Penalty Policy Banner */}
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-bold">Contribution Grace & Penalty Policy:</span>{" "}
                    Members have <strong>{contributionGraceDays} calendar days</strong> after each cutoff date to remit their share contribution before the{" "}
                    <strong>{latePenaltyRatePercent}% Late Penalty Charge Rate</strong> is imposed (same penalty rate as loans; Loans apply a{" "}
                    <strong>{loanGraceDays}-day grace period</strong>).
                  </div>
                </div>

                {/* Visual Cutoff Period Contribution Indicator Grid */}
                {cutoffScheduleRows.length > 0 && (
                  <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          Cutoff Period Contribution Indicator
                        </h4>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-semibold">
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Contributed ({contributedRowsCount})
                        </span>
                        <span className="inline-flex items-center gap-1 text-rose-700">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          Delayed / Penalty ({delayedOrOverdueRowsCount})
                        </span>
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <span className="w-2 h-2 rounded-full bg-slate-300" />
                          Upcoming
                        </span>
                        {availableFiscalYears.length > 1 && (
                          <select
                            value={selectedFiscalYear ?? ""}
                            onChange={(e) => {
                              setSelectedFiscalYear(Number(e.target.value));
                              setContribPage(1);
                            }}
                            className="ml-1 px-2 py-0.5 rounded bg-white border border-slate-200 text-xs font-bold text-slate-700"
                          >
                            {availableFiscalYears.map((yr) => (
                              <option key={yr} value={yr}>
                                FY {yr}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {cutoffScheduleRows.map((row) => {
                        const shortDate = new Date(row.cutoffDate).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        );
                        const isContributedOnTime = row.status === "CONTRIBUTED";
                        const isContributedLate = row.status === "CONTRIBUTED_LATE";
                        const isOverdue = row.status === "OVERDUE";
                        const isGrace = row.status === "GRACE_PERIOD";

                        return (
                          <div
                            key={row.key}
                            title={`${row.cutoffLabel} (${shortDate}) — ${
                              row.hasContributed
                                ? `Contributed ${formatCurrency(row.amount)}${
                                    isContributedLate
                                      ? ` (Late ${row.daysLate}d • Penalty ${formatCurrency(
                                          row.penaltyAmount
                                        )})`
                                      : ""
                                  }`
                                : isOverdue
                                ? `Not Contributed — Overdue (${row.daysLate}d) • Penalty ${formatCurrency(
                                    row.penaltyAmount
                                  )}`
                                : isGrace
                                ? `Within ${contributionGraceDays}-Day Grace Period`
                                : "Upcoming Cutoff"
                            }`}
                            className={`px-2 py-1.5 rounded-lg border text-center transition-all ${
                              isContributedOnTime
                                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                                : isContributedLate
                                ? "bg-amber-50 border-amber-300 text-amber-900"
                                : isOverdue
                                ? "bg-rose-50 border-rose-200 text-rose-900"
                                : isGrace
                                ? "bg-amber-50/60 border-amber-200 text-amber-800"
                                : "bg-white border-slate-200 text-slate-400"
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                              <span>C{String(row.cutoffNumber).padStart(2, "0")}</span>
                              {row.hasContributed ? (
                                <CheckCircle
                                  className={`w-3 h-3 ${
                                    isContributedLate
                                      ? "text-amber-600"
                                      : "text-emerald-600"
                                  }`}
                                />
                              ) : isOverdue ? (
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                              ) : (
                                <Clock className="w-3 h-3 text-slate-300" />
                              )}
                            </div>
                            <div className="text-[10px] font-semibold truncate mt-0.5">
                              {shortDate}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Cutoff Schedule & Share Contribution Ledger Table */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 text-emerald-600" />
                      Cutoff Contribution Schedule & Ledger ({filteredScheduleRows.length})
                    </h4>

                    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => {
                          setCutoffFilter("all");
                          setContribPage(1);
                        }}
                        className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                          cutoffFilter === "all"
                            ? "bg-white text-slate-900 shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        All ({cutoffScheduleRows.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCutoffFilter("contributed");
                          setContribPage(1);
                        }}
                        className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                          cutoffFilter === "contributed"
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Contributed ({contributedRowsCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCutoffFilter("delayed");
                          setContribPage(1);
                        }}
                        className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                          cutoffFilter === "delayed"
                            ? "bg-rose-600 text-white shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Delayed / Penalty ({delayedOrOverdueRowsCount})
                      </button>
                    </div>
                  </div>

                  {filteredScheduleRows.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                      No cutoff contribution entries match the selected filter.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 font-semibold text-slate-600 uppercase border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3">Cutoff Period</th>
                              <th className="py-2.5 px-3 text-center">Indicator</th>
                              <th className="py-2.5 px-3">Channel</th>
                              <th className="py-2.5 px-3 text-right">Amount</th>
                              <th className="py-2.5 px-3 text-right">
                                Late Penalty ({latePenaltyRatePercent}%)
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredScheduleRows
                              .slice(
                                (contribPage - 1) * contribPageSize,
                                contribPage * contribPageSize
                              )
                              .map((row) => (
                                <tr
                                  key={row.key}
                                  className={`transition-colors ${
                                    row.status === "OVERDUE"
                                      ? "bg-rose-50/40 hover:bg-rose-50/70"
                                      : row.hasContributed
                                      ? "hover:bg-emerald-50/30"
                                      : "hover:bg-slate-50/70"
                                  }`}
                                >
                                  <td className="py-2.5 px-3">
                                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                                        {row.cutoffLabel}
                                      </span>
                                      <span>{formatDate(row.cutoffDate)}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                      {row.hasContributed && row.recordedAt
                                        ? `Posted: ${formatDate(row.recordedAt)}`
                                        : `${contributionGraceDays}d grace ends: ${formatDate(
                                            row.graceDeadlineIso
                                          )}`}
                                    </div>
                                  </td>

                                  <td className="py-2.5 px-3 text-center">
                                    {row.status === "CONTRIBUTED" ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                                        Contributed
                                      </span>
                                    ) : row.status === "CONTRIBUTED_LATE" ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                        <Clock className="w-3 h-3 text-amber-600" />
                                        Contributed • Late ({row.daysLate}d)
                                      </span>
                                    ) : row.status === "OVERDUE" ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                                        Delayed ({row.daysLate}d)
                                      </span>
                                    ) : row.status === "GRACE_PERIOD" ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                        <Clock className="w-3 h-3 text-amber-600" />
                                        {contributionGraceDays}d Grace Window
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        Upcoming
                                      </span>
                                    )}
                                  </td>

                                  <td className="py-2.5 px-3 text-slate-500">
                                    {row.hasContributed && row.paymentChannel ? (
                                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-medium uppercase text-slate-700">
                                        {row.paymentChannel.replace(/_/g, " ")}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </td>

                                  <td className="py-2.5 px-3 text-right font-bold font-mono">
                                    {row.hasContributed ? (
                                      <span className="text-emerald-800">
                                        {formatCurrency(row.amount)}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">₱0.00</span>
                                    )}
                                  </td>

                                  <td className="py-2.5 px-3 text-right font-mono">
                                    {row.penaltyAmount > 0 ? (
                                      <span
                                        className="font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200"
                                        title={`${latePenaltyRatePercent}% Late Penalty Charge imposed after ${contributionGraceDays}-day grace period`}
                                      >
                                        +{formatCurrency(row.penaltyAmount)}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">₱0.00</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                      <TablePagination
                        page={contribPage}
                        pageSize={contribPageSize}
                        totalItems={filteredScheduleRows.length}
                        onPageChange={setContribPage}
                        onPageSizeChange={setContribPageSize}
                        itemLabel="cutoffs"
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* CONTACT & ACCOUNT PROFILE VIEW */
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-emerald-600" />
                    Contact & Account Details
                  </h4>

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

                        {onRequestDelete && (
                          <button
                            onClick={() => onRequestDelete(member)}
                            className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-colors ml-auto"
                          >
                            Delete / Suspend Dialog
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
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
