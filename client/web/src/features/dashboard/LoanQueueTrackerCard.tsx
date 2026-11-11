import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  Eye,
  Check,
  Calendar,
  Sparkles,
  HandCoins,
} from "lucide-react";
import { api } from "../../services/api";
import { MyQueueStatus } from "../../types";

interface LoanQueueTrackerCardProps {
  onRequestLoan: () => void;
}

export const LoanQueueTrackerCard: React.FC<LoanQueueTrackerCardProps> = ({
  onRequestLoan,
}) => {
  const { data: queueStatus, isLoading } = useQuery<MyQueueStatus>({
    queryKey: ["my-queue"],
    queryFn: async () => {
      const res = await api.get<MyQueueStatus>("/loans/queue/my-queue");
      return res.data;
    },
    refetchInterval: 15000, // Poll queue position every 15 seconds
  });

  if (isLoading) {
    return (
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
        <div className="h-8 bg-slate-200 rounded w-2/3" />
      </div>
    );
  }

  const active = queueStatus?.activeEntry;

  if (!queueStatus?.hasActiveEntry || !active) {
    return (
      <div className="bg-gradient-to-br from-white to-slate-50 p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/80">
            <HandCoins className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">
              Need Financial Assistance? Apply for a Loan
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Sequential FIFO priority queue with statutory 5% upfront interest and bi-monthly payroll deductions.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRequestLoan}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Request Loan
        </button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Queued":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
            <Clock className="w-3 h-3 text-slate-500" /> In Line for Funding
          </span>
        );
      case "UnderReview":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            <Eye className="w-3 h-3 text-amber-600" /> Board Reviewing
          </span>
        );
      case "ReadyForFunding":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 animate-pulse">
            <Check className="w-3 h-3 text-blue-600" /> Ready for Funding
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-gradient-to-r from-emerald-50/50 via-white to-slate-50 p-5 rounded-2xl border border-emerald-200/80 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0">
            #{queueStatus.queuePosition}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">
                Live Loan Queue Tracker: Position #{queueStatus.queuePosition}
              </h4>
              {getStatusBadge(active.status)}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Queue #{active.queueNumber} · {queueStatus.queuePosition === 1 ? "Next in line for bank fund release" : `${queueStatus.queuePosition - 1} application(s) ahead in line`} (of {queueStatus.totalActiveInQueue} active)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Est. Funding Cutoff</span>
            <span className="font-bold text-slate-800 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-emerald-600" />
              {queueStatus.estimatedFundingCutoff ?? "Upcoming Cutoff"}
            </span>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Requested Principal</span>
          <span className="font-mono font-black text-slate-900 text-sm">
            ₱{active.desiredPrincipal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Net Cash Proceeds (95%)</span>
          <span className="font-mono font-black text-emerald-700 text-sm">
            ₱{(active.desiredPrincipal * 0.95).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Amortization Term</span>
          <span className="font-bold text-slate-800">
            {active.termMonths} mo ({active.cutoffsCount} cutoffs)
          </span>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Per Cutoff Repayment</span>
          <span className="font-mono font-bold text-slate-900">
            ₱{active.estimatedCutoffPayment.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Purpose & Info Banner */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
        <span>
          <strong className="text-slate-700">Purpose:</strong> {active.purpose}
        </span>
        <span className="font-mono text-[11px] text-slate-400">
          Applied {new Date(active.requestedAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
};
