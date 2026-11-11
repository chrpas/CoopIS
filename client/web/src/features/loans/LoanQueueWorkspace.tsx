import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Search,
  HandCoins,
  ShieldAlert,
  Eye,
  Check,
} from "lucide-react";
import { api } from "../../services/api";
import { LoanQueueEntry, LiquiditySummary, LoanQueueStatus } from "../../types";
import { useToast } from "../../components/ui/Toast";

export const LoanQueueWorkspace: React.FC = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");

  // 1. Fetch Queue Entries (Admin only)
  const { data: queue = [], isLoading: isLoadingQueue } = useQuery<LoanQueueEntry[]>({
    queryKey: ["loans-queue"],
    queryFn: async () => {
      const res = await api.get<LoanQueueEntry[]>("/loans/queue");
      return res.data;
    },
  });

  // 2. Fetch Bank Liquidity
  const { data: liquidity, isLoading: isLoadingLiquidity } = useQuery<LiquiditySummary>({
    queryKey: ["bank-liquidity"],
    queryFn: async () => {
      const res = await api.get<LiquiditySummary>("/bank-accounts/liquidity");
      return res.data;
    },
  });

  // 3. Disburse Loan Mutation
  const disburseMutation = useMutation({
    mutationFn: async (queueId: string) => {
      const res = await api.post(`/loans/queue/${queueId}/disburse`);
      return res.data;
    },
    onSuccess: (data) => {
      showToast(
        "success",
        "Loan Disbursed & Funded",
        `Loan '${data.loanReference}' successfully originated for ₱${data.principalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}. Funds deducted from operational bank reserves.`
      );
      queryClient.invalidateQueries({ queryKey: ["loans-queue"] });
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["bank-liquidity"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
    onError: (err: any) => {
      showToast(
        "error",
        "Disbursement Blocked",
        err.response?.data?.message || err.message || "Failed to disburse loan from queue."
      );
    },
  });

  // 4. Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: LoanQueueStatus; notes?: string }) => {
      const res = await api.put(`/loans/queue/${id}/status`, { status, adminNotes: notes });
      return res.data;
    },
    onSuccess: (data) => {
      showToast("success", "Queue Status Updated", `Application #${data.queueNumber} status set to ${data.status}.`);
      queryClient.invalidateQueries({ queryKey: ["loans-queue"] });
    },
    onError: (err: any) => {
      showToast("error", "Status Update Failed", err.response?.data?.message || err.message);
    },
  });

  const availableCash = liquidity?.availableLiquidCash ?? 0;
  const isLiquidityConstrained = availableCash <= 50000;

  // Filtered Queue
  const filteredQueue = queue.filter((entry) => {
    if (statusFilter === "active") {
      if (entry.status !== "Queued" && entry.status !== "UnderReview" && entry.status !== "ReadyForFunding") return false;
    } else if (statusFilter !== "all" && entry.status !== statusFilter) {
      return false;
    }
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      entry.memberName.toLowerCase().includes(term) ||
      entry.memberCode.toLowerCase().includes(term) ||
      entry.queueNumber.toString().includes(term) ||
      entry.purpose.toLowerCase().includes(term)
    );
  });

  const getStatusBadge = (status: LoanQueueStatus) => {
    switch (status) {
      case "Queued":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3 h-3 text-slate-500" /> Queued (FIFO)
          </span>
        );
      case "UnderReview":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            <Eye className="w-3 h-3 text-amber-600" /> Under Review
          </span>
        );
      case "ReadyForFunding":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
            <Check className="w-3 h-3 text-blue-600" /> Ready for Funding
          </span>
        );
      case "Disbursed":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Disbursed
          </span>
        );
      case "Rejected":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" /> Rejected
          </span>
        );
      case "Cancelled":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
            Cancelled
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner: Liquidity Constraints & Unallocated Bank Balance */}
      <div
        className={`p-5 rounded-2xl border transition-all ${
          isLiquidityConstrained
            ? "bg-amber-50/80 border-amber-300 text-amber-950"
            : "bg-emerald-50/70 border-emerald-200 text-emerald-950"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                isLiquidityConstrained ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {isLiquidityConstrained ? (
                <ShieldAlert className="w-6 h-6" />
              ) : (
                <HandCoins className="w-6 h-6" />
              )}
            </div>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider block opacity-75">
                Available Unallocated Bank Balance for Lending
              </span>
              <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight mt-0.5">
                ₱{availableCash.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs opacity-80 mt-1">
                Safeguarding 20% liquid reserve cushion (₱{(liquidity?.reserveCushionAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}). Loans are funded in strict sequential FIFO order.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 shrink-0 bg-white/70 p-3 rounded-xl border border-slate-200/60 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">In-Queue Demands</span>
              <span className="font-mono font-bold text-slate-800">
                ₱{(liquidity?.queuedLoanDemands ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Net Buffer</span>
              <span className="font-mono font-bold text-emerald-700">
                ₱{(liquidity?.netUnallocatedCash ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Queue Controls Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search queue by member name, code, purpose, or #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs font-medium pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Status:</span>
          {[
            { id: "active", label: "Active Queue" },
            { id: "all", label: "All History" },
            { id: "Queued", label: "Queued" },
            { id: "UnderReview", label: "Under Review" },
            { id: "ReadyForFunding", label: "Ready for Funding" },
            { id: "Disbursed", label: "Disbursed" },
            { id: "Rejected", label: "Rejected" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                statusFilter === tab.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. FIFO Queue Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              FIFO Loan Priority Queue
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {filteredQueue.length} application{filteredQueue.length === 1 ? "" : "s"} shown
          </span>
        </div>

        {isLoadingQueue || isLoadingLiquidity ? (
          <div className="py-20 text-center text-xs text-slate-400">
            Loading queue entries...
          </div>
        ) : filteredQueue.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-600">No applications found in queue.</p>
            <p className="text-xs text-slate-400">
              Members can apply for loans from their Member Portal dashboard or administrators can register applications.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Queue #</th>
                  <th className="py-3 px-4">Member Name & Code</th>
                  <th className="py-3 px-4 text-right">Desired Principal</th>
                  <th className="py-3 px-4 text-center">Tier & Cutoffs</th>
                  <th className="py-3 px-4 text-right">Est. Cutoff Payment</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Requested Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredQueue.map((entry) => {
                  const isDisbursed = entry.status === "Disbursed";
                  const isTerminal = isDisbursed || entry.status === "Rejected" || entry.status === "Cancelled";
                  const hasSufficientLiquidity = entry.desiredPrincipal <= availableCash;
                  const canDisburse = !isTerminal && hasSufficientLiquidity;

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center font-mono font-black text-xs border border-slate-200">
                            #{entry.queueNumber}
                          </span>
                          {!isTerminal && (
                            <span className="text-[10px] font-bold text-slate-400">
                              (Pos {entry.queuePosition})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div>
                          <span>{entry.memberName}</span>
                          <span className="block text-[11px] font-mono text-slate-400 font-normal">
                            {entry.memberCode} · Purpose: {entry.purpose}
                          </span>
                          {entry.coMakerMemberName && (
                            <span className="block text-[10px] text-slate-500 font-normal mt-0.5">
                              Co-maker: {entry.coMakerMemberName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 text-sm">
                        ₱{entry.desiredPrincipal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-600 font-medium">
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-700">
                          {entry.termMonths} mo · {entry.cutoffsCount} cutoffs
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700 text-xs">
                        ₱{entry.estimatedCutoffPayment.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {getStatusBadge(entry.status)}
                        {isDisbursed && entry.disbursedLoanReference && (
                          <span className="block text-[10px] font-mono font-bold text-emerald-700 mt-0.5">
                            {entry.disbursedLoanReference}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-500 text-[11px]">
                        {new Date(entry.requestedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {isDisbursed ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 px-2 py-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Funded
                          </span>
                        ) : isTerminal ? (
                          <span className="text-xs text-slate-400 italic">No action</span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            {/* Disburse Button with liquidity check */}
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Disburse and fund Loan Queue #${entry.queueNumber} for ${entry.memberName}?\n\nPrincipal: ₱${entry.desiredPrincipal.toLocaleString()}\nNet Cash Payout: ₱${(entry.desiredPrincipal * 0.95).toLocaleString()} (5% interest deducted)\nFunds will be deducted from primary operational bank balance.`
                                  )
                                ) {
                                  disburseMutation.mutate(entry.id);
                                }
                              }}
                              disabled={!canDisburse || disburseMutation.isPending}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                canDisburse
                                  ? "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs cursor-pointer"
                                  : "bg-slate-100 text-slate-400 border border-slate-200 opacity-60 cursor-not-allowed"
                              }`}
                              title={
                                !hasSufficientLiquidity
                                  ? `Insufficient liquid bank reserves (Need ₱${entry.desiredPrincipal.toLocaleString()}, Available: ₱${availableCash.toLocaleString()} after 20% cushion).`
                                  : "Disburse and fund loan"
                              }
                            >
                              <HandCoins className="w-3.5 h-3.5" />
                              {disburseMutation.isPending ? "Disbursing..." : "Disburse & Fund"}
                            </button>

                            {/* Quick status update button */}
                            {entry.status === "Queued" && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    id: entry.id,
                                    status: "UnderReview",
                                  })
                                }
                                disabled={updateStatusMutation.isPending}
                                className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                                title="Mark Under Review"
                              >
                                Review
                              </button>
                            )}
                            {entry.status === "UnderReview" && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    id: entry.id,
                                    status: "ReadyForFunding",
                                  })
                                }
                                disabled={updateStatusMutation.isPending}
                                className="px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg cursor-pointer"
                                title="Mark Ready for Funding"
                              >
                                Ready
                              </button>
                            )}

                            {/* Reject button */}
                            <button
                              type="button"
                              onClick={() => {
                                const reason = prompt(`Reason for rejecting Queue #${entry.queueNumber}:`);
                                if (reason !== null) {
                                  updateStatusMutation.mutate({
                                    id: entry.id,
                                    status: "Rejected",
                                    notes: reason || "Rejected by administrator",
                                  });
                                }
                              }}
                              disabled={updateStatusMutation.isPending}
                              className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors rounded-lg cursor-pointer"
                              title="Reject application"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
