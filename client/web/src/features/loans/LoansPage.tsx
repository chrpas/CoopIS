import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Loan, Member, LoanStatus, AmortizationScheduleItem } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { LoanOriginationWizard } from "./LoanOriginationWizard";
import { RecordRepaymentModal } from "./RecordRepaymentModal";
import { LoanPenaltiesModal } from "./LoanPenaltiesModal";
import {
  Plus,
  CheckCircle,
  Clock,
  Ban,
  FileText,
  Calendar,
  X,
  AlertCircle,
  CreditCard,
  CheckCircle2,
} from "lucide-react";

export const LoansPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showWizard, setShowWizard] = useState(false);
  const [selectedLoanForSchedule, setSelectedLoanForSchedule] = useState<Loan | null>(null);
  const [selectedCutoffForRepayment, setSelectedCutoffForRepayment] = useState<AmortizationScheduleItem | null>(null);
  const [isRepaymentModalOpen, setIsRepaymentModalOpen] = useState(false);
  const [isPenaltiesModalOpen, setIsPenaltiesModalOpen] = useState(false);

  const { data: loans = [], isLoading } = useQuery<Loan[]>({
    queryKey: ["loans"],
    queryFn: async () => {
      const res = await api.get<Loan[]>("/loans");
      return res.data;
    },
  });

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["members-lookup"],
    queryFn: async () => {
      try {
        const res = await api.get<any>("/members?pageSize=100");
        return Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
      } catch {
        return [];
      }
    },
  });

  // Query amortization schedule for selected loan
  const { data: schedule = [], isLoading: isLoadingSchedule } = useQuery<AmortizationScheduleItem[]>({
    queryKey: ["loan-schedule", selectedLoanForSchedule?.id],
    queryFn: async () => {
      if (!selectedLoanForSchedule) return [];
      const res = await api.get<AmortizationScheduleItem[]>(`/loans/${selectedLoanForSchedule.id}/schedule`);
      return res.data;
    },
    enabled: !!selectedLoanForSchedule,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ loanId, status }: { loanId: string; status: LoanStatus }) => {
      return await api.put(`/loans/${loanId}/status`, {
        status,
        approvedBy: user?.id,
        notes: `Status transitioned to ${status} by ${user?.username}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      if (selectedLoanForSchedule) {
        queryClient.invalidateQueries({ queryKey: ["loan-schedule", selectedLoanForSchedule.id] });
      }
    },
  });

  const totalLatePenaltiesCollected = loans.reduce(
    (acc, l) => acc + Number(l.totalLatePenalties || 0),
    0
  );

  const getStatusBadge = (status: LoanStatus) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle className="w-3 h-3 text-emerald-600" /> ACTIVE
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <CheckCircle className="w-3 h-3 text-blue-600" /> APPROVED
          </span>
        );
      case "PENDING_APPROVAL":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3 text-amber-600" /> PENDING
          </span>
        );
      case "PAID":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
            PAID
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
            <Ban className="w-3 h-3 text-rose-600" /> {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Loan Portfolio</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              Cooperative Lending Service
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Automated term tiering (2-8 months), 5% upfront flat interest, and semi-monthly payroll amortizations with late penalty tracking.
          </p>
        </div>

        <button
          onClick={() => setShowWizard(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-lg shadow-sm transition-all hover:shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Originate Loan (Wizard)
        </button>
      </div>

      {/* Loan Policy & Penalty Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase">Ceiling & Tiers</div>
          <div className="text-base font-bold text-slate-900 mt-0.5">₱80,000 PHP Max</div>
          <div className="text-[11px] text-slate-500">7 Tiers (4 to 16 Cutoffs)</div>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase">Upfront Interest</div>
          <div className="text-base font-bold text-amber-700 mt-0.5">5.00% Flat</div>
          <div className="text-[11px] text-slate-500">Deducted at Release</div>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase">Amortization Cycle</div>
          <div className="text-base font-bold text-emerald-700 mt-0.5">Semi-Monthly</div>
          <div className="text-[11px] text-slate-500">15th & End of Month</div>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase">Active Portfolio</div>
          <div className="text-base font-bold text-slate-900 mt-0.5">{loans.length} Loans</div>
          <div className="text-[11px] text-slate-500">Fully Tracked</div>
        </div>
        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl shadow-xs">
          <div className="text-[11px] font-semibold text-amber-800 uppercase flex items-center justify-between">
            <span>Late Penalties</span>
            <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-bold">2% Rate</span>
          </div>
          <div className="text-base font-extrabold text-amber-950 mt-0.5 font-mono">
            ₱{totalLatePenaltiesCollected.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-amber-700">Cumulative Co-op Income</div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading loan records...</div>
        ) : loans.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No loans found in portfolio. Click "Originate Loan (Wizard)" to create an initial record.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Borrower</th>
                  <th className="py-3 px-4 text-right">Principal</th>
                  <th className="py-3 px-4 text-right">Upfront Int. (5%)</th>
                  <th className="py-3 px-4 text-right">Net Released</th>
                  <th className="py-3 px-4 text-right">Amortization</th>
                  <th className="py-3 px-4 text-right">Late Penalties</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        {loan.loanReference}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {loan.memberName}
                      {loan.notes && (
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">
                          {loan.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      ₱{Number(loan.principalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right text-amber-700 font-medium">
                      ₱{Number(loan.interestEarned).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right text-emerald-700 font-medium">
                      ₱{Number(loan.releasedAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="font-semibold text-slate-900">
                        ₱{Number(loan.cutoffPaymentAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {loan.cutoffsCount} cutoffs ({loan.termMonths} mos)
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {Number(loan.totalLatePenalties || 0) > 0 ? (
                        <span className="font-mono font-bold text-amber-800 text-xs px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
                          ₱{Number(loan.totalLatePenalties).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">₱0.00</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {getStatusBadge(loan.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedLoanForSchedule(loan)}
                          className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          Schedule
                        </button>
                        {loan.status === "PENDING_APPROVAL" && (
                          <button
                            onClick={() =>
                              updateStatusMutation.mutate({
                                loanId: loan.id,
                                status: "APPROVED",
                              })
                            }
                            className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded transition-colors cursor-pointer"
                          >
                            Approve
                          </button>
                        )}
                        {loan.status === "APPROVED" && (
                          <button
                            onClick={() =>
                              updateStatusMutation.mutate({
                                loanId: loan.id,
                                status: "ACTIVE",
                              })
                            }
                            className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded transition-colors cursor-pointer"
                          >
                            Disburse
                          </button>
                        )}
                        {loan.status === "ACTIVE" && (
                          <button
                            onClick={() =>
                              updateStatusMutation.mutate({
                                loanId: loan.id,
                                status: "PAID",
                              })
                            }
                            className="px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                          >
                            Mark Paid
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Loan Origination Wizard Modal */}
      <LoanOriginationWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        members={members}
      />

      {/* Amortization Schedule & Repayment Engine Modal */}
      {selectedLoanForSchedule && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm">Amortization Schedule: {selectedLoanForSchedule.loanReference}</h3>
                  <p className="text-xs text-slate-300">
                    Borrower: {selectedLoanForSchedule.memberName} • ₱{Number(selectedLoanForSchedule.principalAmount).toLocaleString()} Principal • 3-Day Grace Policy
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPenaltiesModalOpen(true)}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="View Late Penalties Audit"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Audit Penalties
                </button>
                <button
                  onClick={() => setSelectedLoanForSchedule(null)}
                  className="text-slate-400 hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[11px] text-slate-500 font-semibold uppercase">Cutoff Payment</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5 font-mono">
                    ₱{Number(selectedLoanForSchedule.cutoffPaymentAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                  <div className="text-[11px] text-amber-700 font-semibold uppercase">5% Upfront Int.</div>
                  <div className="text-base font-bold text-amber-800 mt-0.5 font-mono">
                    ₱{Number(selectedLoanForSchedule.interestEarned).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="text-[11px] text-emerald-700 font-semibold uppercase">Net Disbursed</div>
                  <div className="text-base font-bold text-emerald-800 mt-0.5 font-mono">
                    ₱{Number(selectedLoanForSchedule.releasedAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-xl">
                  <div className="text-[11px] text-amber-900 font-semibold uppercase flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3 text-amber-700" /> Late Penalties Paid
                  </div>
                  <div className="text-base font-extrabold text-amber-950 mt-0.5 font-mono">
                    ₱{Number(
                      selectedLoanForSchedule.totalLatePenalties ||
                        schedule.reduce((acc, s) => acc + (s.latePenaltyPaid || 0), 0)
                    ).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Schedule Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                {isLoadingSchedule ? (
                  <div className="p-8 text-center text-xs text-slate-500">Loading schedule items...</div>
                ) : schedule.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No scheduled cutoffs recorded yet. (Activate or Approve the loan to populate future cutoffs).
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Cutoff Period</th>
                        <th className="py-2.5 px-3 text-right">Scheduled Principal</th>
                        <th className="py-2.5 px-3 text-right">Principal Paid</th>
                        <th className="py-2.5 px-3 text-right">Late Penalty (₱)</th>
                        <th className="py-2.5 px-3 text-right">Remaining</th>
                        <th className="py-2.5 px-3 text-center">Status & Delay</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {schedule.map((item) => {
                        const isOverdue = item.status === "OVERDUE";
                        const isDelayed = item.isDelayed;

                        return (
                          <tr
                            key={item.installmentNumber}
                            className={`transition-colors ${
                              isOverdue
                                ? "bg-rose-50/40 hover:bg-rose-50/70"
                                : isDelayed
                                ? "bg-amber-50/30 hover:bg-amber-50/60"
                                : "hover:bg-slate-50/70"
                            }`}
                          >
                            <td className="py-2.5 px-3 font-semibold text-slate-600">
                              {item.installmentNumber}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-900">
                              <span className="px-2 py-0.5 rounded bg-slate-100 font-bold mr-1.5 font-mono">
                                {item.cutoffLabel}
                              </span>
                              <span className="text-slate-400">
                                {new Date(item.cutoffDate).toLocaleDateString()}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                              ₱{Number(item.scheduledPrincipal).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold font-mono">
                              ₱{Number(item.principalPaid).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">
                              {Number(item.latePenaltyPaid || 0) > 0 ? (
                                <span className="font-bold text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded">
                                  ₱{Number(item.latePenaltyPaid).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="text-slate-400">₱0.00</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-600 font-medium font-mono">
                              ₱{Number(item.remainingBalance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {isOverdue ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                  <AlertCircle className="w-3 h-3 text-rose-600" />
                                  OVERDUE {item.daysOverdue ? `(${item.daysOverdue}d late)` : ""}
                                </span>
                              ) : isDelayed ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  DELAYED {item.daysOverdue ? `(${item.daysOverdue}d late)` : ""}
                                </span>
                              ) : item.status === "PAID" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  PAID
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                  PENDING
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => {
                                  setSelectedCutoffForRepayment(item);
                                  setIsRepaymentModalOpen(true);
                                }}
                                className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors cursor-pointer flex items-center gap-1 mx-auto"
                                title="Log repayment for this cutoff"
                              >
                                <CreditCard className="w-3 h-3" />
                                {item.status === "PAID" ? "Add Fee" : "Pay Cutoff"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Payments automatically reconcile with the cooperative fund audit ledger.</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLoanForSchedule(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Close Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Repayment Modal */}
      <RecordRepaymentModal
        loan={selectedLoanForSchedule}
        cutoffItem={selectedCutoffForRepayment}
        isOpen={isRepaymentModalOpen}
        onClose={() => {
          setIsRepaymentModalOpen(false);
          setSelectedCutoffForRepayment(null);
        }}
      />

      {/* Loan Penalties Audit Modal */}
      <LoanPenaltiesModal
        loan={selectedLoanForSchedule}
        isOpen={isPenaltiesModalOpen}
        onClose={() => setIsPenaltiesModalOpen(false)}
        onPayCutoff={(cutoffId) => {
          const target = schedule.find((s) => s.cutoffId === cutoffId);
          if (target) {
            setSelectedCutoffForRepayment(target);
            setIsRepaymentModalOpen(true);
          }
        }}
      />
    </div>
  );
};
