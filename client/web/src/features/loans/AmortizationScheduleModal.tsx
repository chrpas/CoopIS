import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Loan, AmortizationScheduleItem } from "../../types";
import { TablePagination, DEFAULT_PAGE_SIZE } from "../../components/ui/TablePagination";
import { RecordRepaymentModal } from "./RecordRepaymentModal";
import {
  X,
  Calendar,
  CreditCard,
  AlertCircle,
  Clock,
  CheckCircle2,
  DollarSign,
  Coins,
  RefreshCw,
} from "lucide-react";

interface AmortizationScheduleModalProps {
  loan: Loan | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenPenaltiesAudit?: () => void;
}

export const AmortizationScheduleModal: React.FC<AmortizationScheduleModalProps> = ({
  loan,
  isOpen,
  onClose,
}) => {
  const [selectedCutoffForPayment, setSelectedCutoffForPayment] =
    useState<AmortizationScheduleItem | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  // Fetch loan amortization schedule reactively
  const {
    data: schedule = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery<AmortizationScheduleItem[]>({
    queryKey: ["loan-schedule", loan?.id],
    queryFn: async () => {
      if (!loan) return [];
      const res = await api.get<AmortizationScheduleItem[]>(
        `/loans/${loan.id}/schedule`
      );
      return res.data;
    },
    enabled: Boolean(loan?.id && isOpen),
  });

  if (!isOpen || !loan) return null;

  // Calculate dynamic metrics
  const totalPrincipal = Number(loan.principalAmount) || 0;
  const totalPrincipalPaid = schedule.reduce(
    (sum, item) => sum + (Number(item.principalPaid) || 0),
    0
  );
  // Dynamic remaining balance: remainingBalance = principalAmount - sum(repayments.principalPaid)
  const remainingBalance = Math.max(0, totalPrincipal - totalPrincipalPaid);

  const isScheduleItemPaid = (item: AmortizationScheduleItem) =>
    (item.status || "").toUpperCase() === "PAID" ||
    Math.round((Number(item.principalPaid) || 0) * 100) >=
      Math.round((Number(item.scheduledPrincipal) || 0) * 100);

  const totalPenaltiesPaid = schedule.reduce(
    (sum, item) => sum + (Number(item.latePenaltyPaid) || 0),
    0
  );
  const totalPenaltiesAccrued = schedule.reduce(
    (sum, item) =>
      sum + (isScheduleItemPaid(item) ? 0 : Number(item.accruedPenalty) || 0),
    0
  );
  const totalPenaltiesCollected = schedule.reduce((sum, item) => {
    const paidPenalty = Number(item.latePenaltyPaid) || 0;
    const accruedPenalty = isScheduleItemPaid(item)
      ? 0
      : Number(item.accruedPenalty) || 0;
    return sum + (paidPenalty > 0 ? paidPenalty + accruedPenalty : accruedPenalty);
  }, 0);

  const percentRepaid =
    totalPrincipal > 0
      ? Math.min(100, Math.round((totalPrincipalPaid / totalPrincipal) * 100))
      : 0;

  const handleRecordPayment = (item: AmortizationScheduleItem) => {
    setSelectedCutoffForPayment(item);
    setIsPaymentModalOpen(true);
  };

  const getStatusBadge = (status: string, daysOverdue?: number) => {
    const normalized = (status || "").toUpperCase();

    if (normalized === "PAID") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Paid
        </span>
      );
    }

    if (normalized === "OVERDUE") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs animate-pulse">
          <AlertCircle className="w-3 h-3 text-rose-600" />
          Overdue {daysOverdue ? `(${daysOverdue}d)` : ""}
        </span>
      );
    }

    // Default: UPCOMING / PENDING
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        <Clock className="w-3 h-3 text-slate-500" />
        Upcoming
      </span>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
        <div className="fixed inset-0" onClick={onClose} />

        <div className="relative bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] z-10 transition-all">
          {/* Modal Header */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-base text-white">
                    Loan Amortization Schedule
                  </h3>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-xs font-bold">
                    {loan.loanReference}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  Borrower:{" "}
                  <span className="font-semibold text-slate-200">
                    {loan.memberName}
                  </span>{" "}
                  • 14-Day Grace Policy • 5% Late Penalty Rate
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Refresh Books"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-emerald-400" : ""}`}
                />
                Refresh Books
              </button>

              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
            {/* Top Summary Metrics: Total Principal, Remaining Balance, Total Penalties Collected */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Total Principal */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Total Principal
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-slate-200/60 flex items-center justify-center text-slate-700">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                  ₱
                  {totalPrincipal.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                  <span>
                    {loan.cutoffsCount} Cutoffs ({loan.termMonths} Months)
                  </span>
                  <span>•</span>
                  <span>
                    ₱
                    {Number(loan.cutoffPaymentAmount).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    /cutoff
                  </span>
                </div>
              </div>

              {/* Remaining Balance */}
              <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl relative overflow-hidden">
                <div className="flex items-center justify-between text-emerald-800">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Remaining Balance
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {percentRepaid}% Repaid
                  </span>
                </div>
                <div className="text-2xl font-black text-emerald-950 mt-2 font-mono">
                  ₱
                  {remainingBalance.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </div>
                <div className="w-full bg-emerald-200/60 h-1.5 rounded-full mt-2.5 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${percentRepaid}%` }}
                  />
                </div>
                <div className="text-[11px] text-emerald-700 mt-1">
                  ₱
                  {totalPrincipalPaid.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  principal amortized so far
                </div>
              </div>

              {/* Total Late Penalties */}
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl relative overflow-hidden">
                <div className="flex items-center justify-between text-amber-900">
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    Total Late Penalties
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-amber-200/60 flex items-center justify-center text-amber-800">
                    <Coins className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-amber-950 mt-2 font-mono">
                  ₱
                  {totalPenaltiesCollected.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </div>
                <div className="text-[11px] text-amber-800/80 mt-1">
                  ₱{totalPenaltiesPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })} paid • ₱{totalPenaltiesAccrued.toLocaleString("en-US", { minimumFractionDigits: 2 })} accrued
                </div>
              </div>
            </div>

            {/* Scheduled Cutoffs Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                  Amortization Schedule Entries ({schedule.length} installments)
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Showing all scheduled fiscal cutoffs
                </div>
              </div>

              {isLoading ? (
                <div className="p-10 text-center text-slate-400 text-xs">
                  Loading amortization schedule...
                </div>
              ) : schedule.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-xs">
                  No amortization schedule recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/70 text-slate-600 font-bold uppercase text-[11px] border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-3 px-3.5 text-center w-10">#</th>
                        <th className="py-3 px-3.5">Cutoff Date</th>
                        <th className="py-3 px-3.5 text-right">
                          Scheduled Amount
                        </th>
                        <th className="py-3 px-3.5 text-right">Paid Amount</th>
                        <th className="py-3 px-3.5 text-right">
                          Remaining Balance
                        </th>
                        <th className="py-3 px-3.5 text-right">
                          Late Penalty (₱)
                        </th>
                        <th className="py-3 px-3.5 text-center">Status</th>
                        <th className="py-3 px-3.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {schedule
                        .slice((page - 1) * pageSize, page * pageSize)
                        .map((item) => {
                        const isPaid = isScheduleItemPaid(item);
                        const effectiveStatus = isPaid ? "PAID" : item.status;
                        const isOverdue = !isPaid && effectiveStatus === "OVERDUE";

                        return (
                          <tr
                            key={item.installmentNumber}
                            className={`transition-colors ${
                              isOverdue
                                ? "bg-rose-50/40 hover:bg-rose-50/70"
                                : isPaid
                                ? "hover:bg-slate-50/60"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <td className="py-3 px-3.5 text-center font-bold text-slate-500">
                              {item.installmentNumber}
                            </td>
                            <td className="py-3 px-3.5">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-lg bg-slate-100 font-mono font-bold text-slate-800 text-[11px] border border-slate-200">
                                  {item.cutoffLabel}
                                </span>
                                <span className="text-slate-600 font-semibold">
                                  {new Date(
                                    item.cutoffDate
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </span>
                              </div>
                              {item.paymentDate && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Paid on:{" "}
                                  {new Date(
                                    item.paymentDate
                                  ).toLocaleDateString()}
                                  {item.paymentChannel && (
                                    <span className="capitalize ml-1">
                                      •{" "}
                                      {item.paymentChannel
                                        .toLowerCase()
                                        .replace(/_/g, " ")}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900">
                              ₱
                              {Number(item.scheduledPrincipal).toLocaleString(
                                "en-US",
                                { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700">
                              ₱
                              {Number(item.principalPaid).toLocaleString(
                                "en-US",
                                { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-semibold text-slate-700">
                              ₱
                              {Number(item.remainingBalance).toLocaleString(
                                "en-US",
                                { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono">
                              {Number(item.latePenaltyPaid || 0) > 0 ? (
                                <span className="font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200">
                                  ₱
                                  {Number(item.latePenaltyPaid).toLocaleString(
                                    "en-US",
                                    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                                  )}
                                </span>
                              ) : !isPaid && Number(item.accruedPenalty || 0) > 0 ? (
                                <span className="font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200" title="Accrued 5% Late Penalty">
                                  +₱{Number(item.accruedPenalty).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (5%)
                                </span>
                              ) : (
                                <span className="text-slate-400">₱0.00</span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-center">
                              {getStatusBadge(effectiveStatus, item.daysOverdue)}
                            </td>
                            <td className="py-3 px-3.5 text-center">
                              {!isPaid && (
                                <button
                                  type="button"
                                  onClick={() => handleRecordPayment(item)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                                    isOverdue
                                      ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-700/20"
                                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-700/20"
                                  }`}
                                  title={`Record repayment for ${item.cutoffLabel}`}
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  Record Payment
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {!isLoading && schedule.length > 0 && (
                <TablePagination
                  page={page}
                  pageSize={pageSize}
                  totalItems={schedule.length}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  itemLabel="installments"
                />
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <div className="text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>
                Repayments dynamically recalculate remaining balances and
                reconcile cooperative loan ledgers.
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Record Repayment Modal */}
      {selectedCutoffForPayment && (
        <RecordRepaymentModal
          loan={loan}
          cutoffItem={selectedCutoffForPayment}
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedCutoffForPayment(null);
          }}
          onSuccess={() => {
            refetch();
          }}
        />
      )}
    </>
  );
};
