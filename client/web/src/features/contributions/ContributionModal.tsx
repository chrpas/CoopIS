import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { memberService } from "../../services/memberService";
import {
  CutoffMemberContribution,
  CutoffPeriod,
  PaymentChannel,
  MemberDetail,
  FinancialPolicyResponse,
} from "../../types";
import { useToast } from "../../components/ui/Toast";
import {
  X,
  Coins,
  CreditCard,
  Building2,
  Banknote,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Clock,
} from "lucide-react";

interface ContributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: CutoffMemberContribution | null;
  cutoff: CutoffPeriod | null;
  onSuccess?: () => void;
}

export const ContributionModal: React.FC<ContributionModalProps> = ({
  isOpen,
  onClose,
  member,
  cutoff,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [selectedCutoffId, setSelectedCutoffId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [paymentChannel, setPaymentChannel] = useState<PaymentChannel>("CASH");
  const [validationError, setValidationError] = useState<string>("");

  // Fetch all cutoff periods
  const { data: cutoffs = [], isLoading: isLoadingCutoffs } = useQuery<CutoffPeriod[]>({
    queryKey: ["cutoff-periods"],
    queryFn: async () => {
      const res = await api.get<CutoffPeriod[]>("/cutoff-periods");
      return res.data;
    },
    enabled: isOpen,
  });

  // Fetch selected member's contribution history so we only list cutoff periods where they haven't contributed
  const { data: memberDetail, isLoading: isLoadingMember } = useQuery<MemberDetail>({
    queryKey: ["member-detail", member?.memberId],
    queryFn: () => {
      if (!member?.memberId) throw new Error("No member ID");
      return memberService.getMemberById(member.memberId);
    },
    enabled: isOpen && Boolean(member?.memberId),
  });

  const { data: financialPolicy } = useQuery<FinancialPolicyResponse>({
    queryKey: ["financial-policy"],
    queryFn: async () => {
      const res = await api.get<FinancialPolicyResponse>("/settings/financial-policy");
      return res.data;
    },
    enabled: isOpen,
  });

  const contributionGraceDays =
    financialPolicy?.activeLoanPolicy.contributionGracePeriodDays ?? 5;
  const latePenaltyRatePercent =
    financialPolicy?.activeLoanPolicy.latePenaltyRatePercent ?? 5.0;

  // Filter cutoff periods to ONLY those where the selected member was NOT able to contribute yet
  const uncontributedCutoffs = useMemo(() => {
    const contributedIds = new Set<string>();
    const contributedLabels = new Set<string>();

    if (memberDetail?.contributions) {
      memberDetail.contributions.forEach((c) => {
        if ((Number(c.amount) || 0) > 0) {
          if (c.cutoffId) contributedIds.add(c.cutoffId);
          if (c.cutoffLabel) contributedLabels.add(c.cutoffLabel);
        }
      });
    } else if (member && (Number(member.amount) || 0) > 0) {
      if (member.cutoffId) contributedIds.add(member.cutoffId);
      if (member.cutoffLabel) contributedLabels.add(member.cutoffLabel);
    }

    return [...cutoffs]
      .filter((c) => !contributedIds.has(c.id) && !contributedLabels.has(c.label))
      .sort(
        (a, b) => new Date(a.cutoffDate).getTime() - new Date(b.cutoffDate).getTime()
      );
  }, [cutoffs, memberDetail, member]);

  // Default selected cutoff to the current page cutoff (if uncontributed) or the first uncontributed cutoff
  useEffect(() => {
    if (!isOpen) return;
    if (uncontributedCutoffs.length > 0) {
      const currentIsUncontributed =
        cutoff && uncontributedCutoffs.some((c) => c.id === cutoff.id);
      if (currentIsUncontributed && cutoff) {
        setSelectedCutoffId(cutoff.id);
      } else if (
        !selectedCutoffId ||
        !uncontributedCutoffs.some((c) => c.id === selectedCutoffId)
      ) {
        setSelectedCutoffId(uncontributedCutoffs[0].id);
      }
    } else {
      setSelectedCutoffId("");
    }
  }, [isOpen, cutoff, uncontributedCutoffs]);

  // Sync default amount and channel whenever member opens in modal
  useEffect(() => {
    if (member && isOpen) {
      const usualAmount =
        memberDetail && memberDetail.totalContributionsCount > 0
          ? Math.round(
              memberDetail.totalShareContributions / memberDetail.totalContributionsCount
            )
          : member.amount && member.amount > 0
          ? member.amount
          : 0;
      setAmount(usualAmount > 0 ? usualAmount.toString() : "");
      setPaymentChannel(member.paymentChannel || "CASH");
      setValidationError("");
    }
  }, [member, memberDetail, isOpen]);

  const targetCutoff = useMemo(
    () =>
      uncontributedCutoffs.find((c) => c.id === selectedCutoffId) ||
      cutoffs.find((c) => c.id === selectedCutoffId) ||
      cutoff,
    [uncontributedCutoffs, cutoffs, selectedCutoffId, cutoff]
  );

  const isTargetDelayedPastGrace = useMemo(() => {
    if (!targetCutoff) return false;
    const cDate = new Date(targetCutoff.cutoffDate);
    const graceDeadline = new Date(cDate);
    graceDeadline.setDate(graceDeadline.getDate() + contributionGraceDays);
    graceDeadline.setHours(23, 59, 59, 999);
    return new Date() > graceDeadline;
  }, [targetCutoff, contributionGraceDays]);

  const isLocked = uncontributedCutoffs.length === 0 && !isLoadingMember && !isLoadingCutoffs;

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      amount: number;
      cutoffId: string;
      paymentChannel: PaymentChannel;
    }) => {
      if (!member) throw new Error("Missing member");
      const res = await api.patch<{
        contributionId: string;
        id: string;
        memberId: string;
        cutoffId: string;
        amount: number;
        paymentChannel: PaymentChannel;
        recordedAt: string;
      }>(`/contributions/${member.memberId}`, {
        amount: payload.amount,
        memberId: member.memberId,
        cutoffId: payload.cutoffId,
        paymentChannel: payload.paymentChannel,
      });
      return res.data;
    },
    onSuccess: (data) => {
      const assignedLabel = targetCutoff?.label || cutoff?.label || "selected cutoff";
      showToast(
        "success",
        "Contribution Recorded",
        `Successfully recorded ₱${data.amount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
        })} for ${member?.memberName} (${assignedLabel}).`
      );
      queryClient.invalidateQueries({
        queryKey: ["contributions-cutoff"],
      });
      queryClient.invalidateQueries({ queryKey: ["contributions-summary"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-balance-sheet"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-fund-reconciliation"] });
      if (member?.memberId) {
        queryClient.invalidateQueries({
          queryKey: ["member-detail", member.memberId],
        });
      }
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        "Failed to save contribution.";
      setValidationError(msg);
      showToast("error", "Save Failed", msg);
    },
  });

  if (!isOpen || !member || !cutoff) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    if (!selectedCutoffId) {
      setValidationError(
        "Please select an uncontributed cutoff period to assign this contribution."
      );
      return;
    }

    const clean = amount.trim();
    const num = clean === "" ? 0 : parseFloat(clean);

    if (isNaN(num) || num <= 0) {
      setValidationError("Please enter a contribution amount greater than ₱0.00.");
      return;
    }

    saveMutation.mutate({
      amount: num,
      cutoffId: selectedCutoffId,
      paymentChannel,
    });
  };

  const handlePreset = (val: number) => {
    if (isLocked) return;
    setAmount(val === 0 ? "0" : val.toString());
    setValidationError("");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden transition-all transform scale-100">
        {/* Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Record Contribution
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Assign to Cutoff:{" "}
                <span className="font-semibold text-emerald-400">
                  {targetCutoff?.label || "Select Cutoff"}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Member Profile Card */}
        <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center">
              {member.memberName
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">
                {member.memberName}
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <span className="font-mono font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  {member.memberCode}
                </span>
                <span>•</span>
                <span>{member.email}</span>
              </div>
            </div>
          </div>

          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              member.status === "ACTIVE"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {member.status}
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {validationError && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Uncontributed Cutoff Period Dropdown */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="target-cutoff-select"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
              >
                Assign to Cutoff Period <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] font-semibold text-emerald-700">
                {uncontributedCutoffs.length} uncontributed{" "}
                {uncontributedCutoffs.length === 1 ? "cutoff" : "cutoffs"}
              </span>
            </div>

            {isLoadingMember || isLoadingCutoffs ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                Loading member's uncontributed cutoff periods...
              </div>
            ) : uncontributedCutoffs.length === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  This member has already contributed for all scheduled cutoff periods.
                </span>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    id="target-cutoff-select"
                    value={selectedCutoffId}
                    onChange={(e) => {
                      setSelectedCutoffId(e.target.value);
                      setValidationError("");
                    }}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 cursor-pointer"
                  >
                    {uncontributedCutoffs.map((c) => {
                      const dateStr = new Date(c.cutoffDate).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      );
                      return (
                        <option key={c.id} value={c.id}>
                          {c.label} — {dateStr} ({c.fiscalYear}){" "}
                          {c.isClosed ? "• [Closed Cutoff]" : "• [Open Cutoff]"}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Lists only cutoff periods where {member.memberName} was not able to contribute yet (including closed cutoffs).
                </p>

                {isTargetDelayedPastGrace && (
                  <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>
                      Past the <strong>{contributionGraceDays}-day cutoff grace period</strong> — a{" "}
                      <strong>{latePenaltyRatePercent}% late penalty charge</strong> applies to this delayed contribution.
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Amount Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Contribution Amount (₱) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-base">
                ₱
              </span>
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                disabled={isLocked}
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || /^\d*\.?\d*$/.test(val)) {
                    setAmount(val);
                    setValidationError("");
                  }
                }}
                className={`w-full text-left font-mono font-bold text-xl pl-9 pr-4 py-2.5 rounded-xl border transition-all focus:outline-none focus:ring-2 ${
                  validationError
                    ? "border-rose-300 focus:ring-rose-400/20"
                    : "border-slate-300 focus:ring-emerald-500/20 focus:border-emerald-600"
                } ${isLocked ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-white text-slate-900"}`}
              />
            </div>

            {/* Quick Presets */}
            {!isLocked && (
              <div className="flex items-center gap-2 mt-2.5">
                <span className="text-[11px] font-semibold text-slate-400">Quick set:</span>
                {[500, 1000, 2500, 5000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePreset(preset)}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 transition-colors"
                  >
                    ₱{preset.toLocaleString()}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handlePreset(0)}
                  className="px-2 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Payment Channel */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Payment Channel
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  id: "CASH" as PaymentChannel,
                  label: "Cash Deposit",
                  icon: Banknote,
                },
                {
                  id: "PAYROLL_DEDUCTION" as PaymentChannel,
                  label: "Payroll Deduction",
                  icon: Building2,
                },
                {
                  id: "BANK_TRANSFER" as PaymentChannel,
                  label: "Bank Transfer",
                  icon: CreditCard,
                },
              ].map((channel) => {
                const Icon = channel.icon;
                const isSelected = paymentChannel === channel.id;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    disabled={isLocked}
                    onClick={() => setPaymentChannel(channel.id)}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-1.5 transition-all ${
                      isSelected
                        ? "bg-emerald-50 border-emerald-600 text-emerald-800 ring-1 ring-emerald-600"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    } ${isLocked ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <Icon
                      className={`w-4 h-4 ${
                        isSelected ? "text-emerald-600" : "text-slate-400"
                      }`}
                    />
                    <span className="text-[11px] font-bold leading-tight">
                      {channel.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dialog Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saveMutation.isPending}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLocked || saveMutation.isPending}
              className={`flex items-center gap-2 text-xs font-bold px-5 py-2 rounded-xl text-white shadow-sm transition-all ${
                isLocked
                  ? "bg-slate-400 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-700/20"
              }`}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Recording Contribution...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Record Contribution
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
