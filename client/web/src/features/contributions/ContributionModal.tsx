import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { CutoffMemberContribution, CutoffPeriod, PaymentChannel } from "../../types";
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
  Lock,
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

  const [amount, setAmount] = useState<string>("");
  const [paymentChannel, setPaymentChannel] = useState<PaymentChannel>("CASH");
  const [validationError, setValidationError] = useState<string>("");

  const isLocked = Boolean(cutoff?.isClosed);

  // Sync state whenever member opens in modal
  useEffect(() => {
    if (member) {
      setAmount(member.amount && member.amount > 0 ? member.amount.toString() : "");
      setPaymentChannel(member.paymentChannel || "CASH");
      setValidationError("");
    }
  }, [member, isOpen]);

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      amount: number;
      paymentChannel: PaymentChannel;
    }) => {
      if (!member || !cutoff) throw new Error("Missing member or cutoff");
      const targetId = member.contributionId || member.memberId;
      const res = await api.patch<{
        contributionId: string;
        id: string;
        memberId: string;
        cutoffId: string;
        amount: number;
        paymentChannel: PaymentChannel;
        recordedAt: string;
      }>(`/contributions/${targetId}`, {
        amount: payload.amount,
        memberId: member.memberId,
        cutoffId: cutoff.id,
        paymentChannel: payload.paymentChannel,
      });
      return res.data;
    },
    onSuccess: (data) => {
      showToast(
        "success",
        "Contribution Recorded",
        `Successfully recorded ₱${data.amount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
        })} for ${member?.memberName}.`
      );
      if (cutoff?.id) {
        queryClient.invalidateQueries({
          queryKey: ["contributions-cutoff", cutoff.id],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["contributions-summary"] });
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

    if (isLocked) {
      setValidationError("Cannot modify contributions for a locked cutoff period.");
      return;
    }

    const clean = amount.trim();
    const num = clean === "" ? 0 : parseFloat(clean);

    if (isNaN(num) || num < 0) {
      setValidationError("Please enter a valid non-negative contribution amount.");
      return;
    }

    saveMutation.mutate({
      amount: num,
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
                Cutoff: <span className="font-semibold text-emerald-400">{cutoff.label}</span>
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
          {isLocked && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-medium">
              <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                This cutoff period is <strong>locked and finalized</strong>. New contributions or adjustments are currently disabled.
              </span>
            </div>
          )}

          {validationError && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

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
