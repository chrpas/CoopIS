import React, { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  HandCoins,
  X,
  Info,
} from "lucide-react";
import { api } from "../../services/api";
import { ApplyLoanQueuePayload, LoanQueueEntry } from "../../types";
import { useToast } from "../../components/ui/Toast";

interface MemberLoanApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  myShareCapital: number;
}

export const MemberLoanApplicationModal: React.FC<MemberLoanApplicationModalProps> = ({
  isOpen,
  onClose,
  myShareCapital,
}) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [principalInput, setPrincipalInput] = useState<string>("20000");
  const [purpose, setPurpose] = useState<string>("");

  const principal = parseFloat(principalInput) || 0;

  // 7-Tier Loan Calculation
  const tierDetails = useMemo(() => {
    let termMonths = 2;
    let cutoffsCount = 4;

    if (principal <= 5000) {
      termMonths = 2;
      cutoffsCount = 4;
    } else if (principal <= 15000) {
      termMonths = 3;
      cutoffsCount = 6;
    } else if (principal <= 25000) {
      termMonths = 4;
      cutoffsCount = 8;
    } else if (principal <= 35000) {
      termMonths = 5;
      cutoffsCount = 10;
    } else if (principal <= 50000) {
      termMonths = 6;
      cutoffsCount = 12;
    } else if (principal <= 70000) {
      termMonths = 7;
      cutoffsCount = 14;
    } else {
      termMonths = 8;
      cutoffsCount = 16;
    }

    const interestRate = 0.05; // 5% standard upfront
    const interestDeduction = Math.round(principal * interestRate * 100) / 100;
    const netCashProceeds = Math.max(0, principal - interestDeduction);
    const cutoffPayment = cutoffsCount > 0 ? Math.round((principal / cutoffsCount) * 100) / 100 : 0;

    return {
      termMonths,
      cutoffsCount,
      interestRate: 5.0,
      interestDeduction,
      netCashProceeds,
      cutoffPayment,
    };
  }, [principal]);

  // Apply to FIFO Loan Queue Mutation
  const applyQueueMutation = useMutation({
    mutationFn: async (payload: ApplyLoanQueuePayload) => {
      const res = await api.post<LoanQueueEntry>("/loans/queue/apply", payload);
      return res.data;
    },
    onSuccess: (data) => {
      showToast(
        "success",
        "Application Queued!",
        `Your loan request has been placed in the FIFO queue at Position #${data.queuePosition} (Queue #${data.queueNumber}).`
      );
      queryClient.invalidateQueries({ queryKey: ["my-queue"] });
      queryClient.invalidateQueries({ queryKey: ["loans-queue"] });
      onClose();
    },
    onError: (err: any) => {
      showToast(
        "error",
        "Application Failed",
        err.response?.data?.message || err.message || "Failed to submit loan request."
      );
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (principal < 1000) {
      showToast("error", "Invalid Principal", "Minimum loan request is ₱1,000.");
      return;
    }
    if (principal > 80000) {
      showToast("error", "Limit Exceeded", "Maximum cooperative loan limit is ₱80,000.");
      return;
    }

    applyQueueMutation.mutate({
      desiredPrincipal: principal,
      purpose: purpose.trim() || "Personal / Emergency Needs",
      coMakerMemberId: null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animation-fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <HandCoins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Request a Loan</h3>
              <p className="text-xs text-slate-500">
                FIFO Sequential Queue with Upfront 5% Interest Policy
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Principal Amount Input */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Desired Principal Amount (PHP) *
              </label>
              <div className="flex items-center gap-2">
                {myShareCapital > 0 && (
                  <span className="text-[11px] text-emerald-700 font-medium">
                    Capital: ₱{myShareCapital.toLocaleString("en-US", { minimumFractionDigits: 2 })} ·
                  </span>
                )}
                <span className="text-[11px] text-slate-400 font-medium">
                  Limit: ₱1,000 – ₱80,000
                </span>
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₱</span>
              <input
                type="number"
                min={1000}
                max={80000}
                step={500}
                required
                value={principalInput}
                onChange={(e) => setPrincipalInput(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 text-base font-mono font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Quick Amount Selectors */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[5000, 10000, 20000, 30000, 50000, 70000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setPrincipalInput(String(amt))}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer shrink-0 ${
                  principal === amt
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                ₱{amt.toLocaleString()}
              </button>
            ))}
          </div>

          {/* 7-Tier Loan Breakdown Card */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                Cooperative Tier Matrix Calculation
              </span>
              <span className="font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
                Tier {tierDetails.termMonths} Months
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 bg-white rounded-xl border border-slate-200/60">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Term & Cutoffs</span>
                <span className="font-bold text-slate-900">
                  {tierDetails.termMonths} Months ({tierDetails.cutoffsCount} Cutoffs)
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200/60">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Per Cutoff Repayment</span>
                <span className="font-mono font-bold text-slate-900">
                  ₱{tierDetails.cutoffPayment.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200/60">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">5% Upfront Interest</span>
                <span className="font-mono font-bold text-rose-600">
                  -₱{tierDetails.interestDeduction.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-2.5 bg-emerald-50/50 rounded-xl border border-emerald-200/70">
                <span className="text-[10px] text-emerald-700 uppercase font-bold block">Net Cash Disbursed</span>
                <span className="font-mono font-black text-emerald-800 text-sm">
                  ₱{tierDetails.netCashProceeds.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Loan Purpose */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Loan Purpose *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Tuition fee, medical assistance, home renovation"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          {/* Liquidity Policy Notice */}
          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/60 flex items-start gap-2.5 text-xs text-blue-900">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Applications are entered into the sequential <strong>FIFO Loan Queue</strong>. When bank reserves allow, your loan is automatically reviewed and disbursed on upcoming semi-monthly payroll cutoffs.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={applyQueueMutation.isPending}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {applyQueueMutation.isPending ? "Submitting Application..." : "Submit to Loan Queue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
