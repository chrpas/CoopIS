import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Loan, AmortizationScheduleItem, LoanRepaymentResponse } from "../../types";
import { useToast } from "../../components/ui/Toast";
import {
  X,
  CreditCard,
  AlertTriangle,
  Clock,
  Calendar,
  Loader2,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";

interface RecordRepaymentModalProps {
  loan: Loan | null;
  cutoffItem: AmortizationScheduleItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const RecordRepaymentModal: React.FC<RecordRepaymentModalProps> = ({
  loan,
  cutoffItem,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [principalInput, setPrincipalInput] = useState<string>("");
  const [latePenaltyInput, setLatePenaltyInput] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Calculate default values and overdue metrics
  useEffect(() => {
    if (cutoffItem && isOpen) {
      const remainingInstallment = Math.max(0, cutoffItem.scheduledPrincipal - cutoffItem.principalPaid);
      setPrincipalInput(remainingInstallment.toFixed(2));

      // If overdue or delayed, prefill accrued penalty (2% of unpaid cutoff amount)
      if (cutoffItem.accruedPenalty && cutoffItem.accruedPenalty > 0) {
        setLatePenaltyInput(cutoffItem.accruedPenalty.toFixed(2));
      } else if (cutoffItem.isDelayed || cutoffItem.status === "OVERDUE") {
        const calculatedPenalty = Math.round(remainingInstallment * 0.02 * 100) / 100;
        setLatePenaltyInput(calculatedPenalty.toFixed(2));
      } else {
        setLatePenaltyInput("0.00");
      }

      setPaymentDate(new Date().toISOString().split("T")[0]);
      setNotes("");
      setErrorMessage(null);
    }
  }, [cutoffItem, isOpen]);

  // Due date and grace period inspection (3 days grace period)
  const isPastDue = React.useMemo(() => {
    if (!cutoffItem) return false;
    const cutoffDate = new Date(cutoffItem.cutoffDate);
    const graceDate = new Date(cutoffDate);
    graceDate.setDate(graceDate.getDate() + 3);
    const selectedPayDate = new Date(paymentDate);
    return selectedPayDate > graceDate || cutoffItem.status === "OVERDUE" || cutoffItem.isDelayed;
  }, [cutoffItem, paymentDate]);

  const daysLate = React.useMemo(() => {
    if (!cutoffItem) return 0;
    const cutoffDate = new Date(cutoffItem.cutoffDate);
    const selectedPayDate = new Date(paymentDate);
    const diffTime = selectedPayDate.getTime() - cutoffDate.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  }, [cutoffItem, paymentDate]);

  const numericPrincipal = parseFloat(principalInput) || 0;
  const numericPenalty = parseFloat(latePenaltyInput) || 0;
  const totalPayment = numericPrincipal + numericPenalty;

  const repaymentMutation = useMutation({
    mutationFn: async () => {
      if (!loan || !cutoffItem) throw new Error("Loan or cutoff is not selected.");

      const payload = {
        cutoffId: cutoffItem.cutoffId,
        principalPaid: numericPrincipal,
        latePenaltyPaid: numericPenalty,
        paymentDate: new Date(paymentDate).toISOString(),
        notes: notes.trim() || undefined,
      };

      const res = await api.post<LoanRepaymentResponse>(`/loans/${loan.id}/repayments`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      showToast(
        "success",
        "Loan Repayment Logged",
        `Received ₱${data.totalPaidThisEntry.toLocaleString("en-US", {
          minimumFractionDigits: 2,
        })} (Principal: ₱${data.principalPaid.toLocaleString()} | Late Penalty: ₱${data.latePenaltyPaid.toLocaleString()}) for ${data.cutoffLabel}.`
      );

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      if (loan) {
        queryClient.invalidateQueries({ queryKey: ["loan-schedule", loan.id] });
        queryClient.invalidateQueries({ queryKey: ["loan-penalties", loan.id] });
      }
      queryClient.invalidateQueries({ queryKey: ["accounting-fund-reconciliation"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-balance-sheet"] });

      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Failed to record loan repayment.";
      setErrorMessage(msg);
      showToast("error", "Repayment Failed", msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (numericPrincipal < 0 || numericPenalty < 0) {
      setErrorMessage("Amounts cannot be negative.");
      return;
    }

    if (totalPayment <= 0) {
      setErrorMessage("Total remittance must be greater than ₱0.00.");
      return;
    }

    repaymentMutation.mutate();
  };

  if (!isOpen || !loan || !cutoffItem) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Record Cutoff Repayment</h3>
              <p className="text-xs text-slate-300">
                Loan {loan.loanReference} • {loan.memberName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Cutoff Details Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Installment #{cutoffItem.installmentNumber}
              </div>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                <span className="px-2 py-0.5 rounded bg-slate-200 font-mono text-xs">
                  {cutoffItem.cutoffLabel}
                </span>
                <span>Due: {new Date(cutoffItem.cutoffDate).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Scheduled Principal</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                ₱{Number(cutoffItem.scheduledPrincipal).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Late Penalty Warning Banner */}
          {isPastDue && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  Delayed Payment Detected
                  {daysLate > 0 && (
                    <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded font-mono text-[10px]">
                      {daysLate} days past cutoff
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  The cutoff has passed the scheduled date (+ 3-day grace period). A standard 2% cooperative late penalty charge has been suggested below.
                </p>
              </div>
            </div>
          )}

          {/* Principal Amount Input */}
          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
              Principal Repayment Amount (₱) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold">
                ₱
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={principalInput}
                onChange={(e) => setPrincipalInput(e.target.value)}
                placeholder="0.00"
                required
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-semibold text-slate-900 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Scheduled installment: ₱{cutoffItem.scheduledPrincipal.toFixed(2)} (Already paid: ₱{cutoffItem.principalPaid.toFixed(2)})
            </p>
          </div>

          {/* Dedicated Late Penalty Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Late Penalty Charge (₱)
              </label>
              {isPastDue && (
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                  2% Standard Rate
                </span>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-amber-600 font-bold">
                ₱
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={latePenaltyInput}
                onChange={(e) => setLatePenaltyInput(e.target.value)}
                placeholder="0.00"
                className={`w-full pl-8 pr-3 py-2 rounded-xl font-mono font-semibold transition-all ${
                  numericPenalty > 0
                    ? "bg-amber-50/50 border-amber-300 text-amber-900 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                    : "bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                }`}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Collected late penalties are recorded into the cooperative revenue account and distributed in the surplus pool.
            </p>
          </div>

          {/* Payment Date Input */}
          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
              Remittance Date
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>

          {/* Notes Input */}
          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
              Notes / OR Reference (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Paid via Payroll Deduction OR# 10294"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          {/* Total Breakdown Summary */}
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between font-mono">
            <div>
              <div className="text-[10px] text-emerald-800 font-semibold uppercase">Total Remittance Collected</div>
              <div className="text-xs text-emerald-700 mt-0.5">
                Principal: ₱{numericPrincipal.toFixed(2)} + Penalty: ₱{numericPenalty.toFixed(2)}
              </div>
            </div>
            <div className="text-base font-extrabold text-emerald-950">
              ₱{totalPayment.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={repaymentMutation.isPending}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={repaymentMutation.isPending || totalPayment <= 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {repaymentMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Confirm & Post Repayment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
