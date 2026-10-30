import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Loan, LoanPenaltySummary } from "../../types";
import {
  X,
  Clock,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  Loader2,
} from "lucide-react";

interface LoanPenaltiesModalProps {
  loan: Loan | null;
  isOpen: boolean;
  onClose: () => void;
  onPayCutoff?: (cutoffId: string) => void;
}

export const LoanPenaltiesModal: React.FC<LoanPenaltiesModalProps> = ({
  loan,
  isOpen,
  onClose,
  onPayCutoff,
}) => {
  const { data: penaltySummary, isLoading } = useQuery<LoanPenaltySummary>({
    queryKey: ["loan-penalties", loan?.id],
    queryFn: async () => {
      if (!loan) throw new Error("No loan selected");
      const res = await api.get<LoanPenaltySummary>(`/loans/${loan.id}/penalties`);
      return res.data;
    },
    enabled: !!loan && isOpen,
  });

  if (!isOpen || !loan) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Overdue Balances & Late Penalty Audit</h3>
              <p className="text-xs text-slate-300">
                Loan {loan.loanReference} • {loan.memberName} • 3-Day Grace Policy
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {isLoading ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
              <span>Analyzing loan cutoff penalties and grace periods...</span>
            </div>
          ) : !penaltySummary ? (
            <div className="py-12 text-center text-slate-400">Unable to load penalty details.</div>
          ) : (
            <>
              {/* Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                  <div className="text-[10px] text-amber-800 font-semibold uppercase">Total Penalties Paid</div>
                  <div className="text-base font-bold text-amber-950 mt-1 font-mono">
                    ₱{Number(penaltySummary.totalLatePenaltiesPaid).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-amber-700 mt-0.5">Credited to Co-op Revenue</div>
                </div>

                <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl">
                  <div className="text-[10px] text-rose-800 font-semibold uppercase">Outstanding Penalties</div>
                  <div className="text-base font-bold text-rose-950 mt-1 font-mono">
                    ₱{Number(penaltySummary.outstandingPenalties).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-rose-700 mt-0.5">Accrued & Unpaid (2% rate)</div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Overdue Cutoffs</div>
                  <div className="text-base font-bold text-slate-900 mt-1">
                    {penaltySummary.overdueCutoffsCount} of {penaltySummary.totalCutoffs}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Past due date + grace</div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Grace Period Policy</div>
                  <div className="text-base font-bold text-slate-900 mt-1">
                    {penaltySummary.gracePeriodDays} Calendar Days
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Zero penalty before expiry</div>
                </div>
              </div>

              {/* Notice Banner */}
              {penaltySummary.overdueCutoffsCount > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span className="font-semibold text-xs">
                      {penaltySummary.overdueCutoffsCount} cut-off installments are past the due date and grace period.
                    </span>
                  </div>
                  <span className="font-mono font-bold text-xs">
                    Pending Penalty: ₱{penaltySummary.outstandingPenalties.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Cutoffs Breakdown Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Cutoff</th>
                      <th className="py-2.5 px-3">Scheduled Due Date</th>
                      <th className="py-2.5 px-3 text-right">Scheduled (₱)</th>
                      <th className="py-2.5 px-3 text-right">Principal Paid</th>
                      <th className="py-2.5 px-3 text-right">Penalty Paid</th>
                      <th className="py-2.5 px-3 text-right">Accrued Penalty</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {penaltySummary.penaltiesBreakdown.map((item, idx) => (
                      <tr
                        key={item.cutoffId}
                        className={`transition-colors ${
                          item.isOverdue
                            ? "bg-rose-50/40 hover:bg-rose-50/70"
                            : item.isDelayed
                            ? "bg-amber-50/40 hover:bg-amber-50/70"
                            : "hover:bg-slate-50/70"
                        }`}
                      >
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          <span className="px-1.5 py-0.5 rounded bg-slate-200/80 font-mono text-[11px] mr-1">
                            #{idx + 1}
                          </span>
                          {item.cutoffLabel}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          <div>{new Date(item.cutoffDate).toLocaleDateString()}</div>
                          <div className="text-[10px] text-slate-400">
                            Grace: {new Date(item.dueDateWithGrace).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                          ₱{Number(item.scheduledPrincipal).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold">
                          ₱{Number(item.principalPaid).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800">
                          ₱{Number(item.latePenaltyPaid).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-700 font-semibold">
                          ₱{Number(item.accruedPenalty).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {item.isOverdue ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              OVERDUE ({item.daysLate}d)
                            </span>
                          ) : item.isDelayed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-600" />
                              DELAYED ({item.daysLate}d)
                            </span>
                          ) : item.status === "PAID" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              PAID ON TIME
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              PENDING
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {item.status !== "PAID" && (
                            <button
                              onClick={() => {
                                onPayCutoff?.(item.cutoffId);
                                onClose();
                              }}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              Pay
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
};
