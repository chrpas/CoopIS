import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Loan, Member, LoanStatus, AmortizationScheduleItem } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { LoanOriginationWizard } from "./LoanOriginationWizard";
import {
  Plus,
  CheckCircle,
  Clock,
  Ban,
  FileText,
  Calendar,
  X,
} from "lucide-react";


export const LoansPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showWizard, setShowWizard] = useState(false);
  const [selectedLoanForSchedule, setSelectedLoanForSchedule] = useState<Loan | null>(null);

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
        const res = await api.get<Member[]>("/members");
        return res.data;
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
            Automated term tiering (2-8 months), 5% upfront flat interest, and semi-monthly payroll amortizations.
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

      {/* Loan Policy Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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
                    <td className="py-3.5 px-4 text-right text-emerald-700 font-bold">
                      ₱{Number(loan.releasedAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-700 font-medium">
                      ₱{Number(loan.cutoffPaymentAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      <div className="text-[10px] text-slate-400">{loan.cutoffsCount} cutoffs ({loan.termMonths} mos)</div>
                    </td>
                    <td className="py-3.5 px-4 text-center">{getStatusBadge(loan.status)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedLoanForSchedule(loan)}
                          title="View Amortization Schedule"
                          className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors inline-flex items-center gap-1 cursor-pointer"
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

      {/* Amortization Schedule Modal */}
      {selectedLoanForSchedule && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm">Amortization Schedule: {selectedLoanForSchedule.loanReference}</h3>
                  <p className="text-xs text-slate-300">
                    Borrower: {selectedLoanForSchedule.memberName} • ₱{Number(selectedLoanForSchedule.principalAmount).toLocaleString()} Principal
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLoanForSchedule(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[11px] text-slate-500 font-semibold uppercase">Cutoff Payment</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    ₱{Number(selectedLoanForSchedule.cutoffPaymentAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                  <div className="text-[11px] text-amber-700 font-semibold uppercase">5% Upfront Int.</div>
                  <div className="text-base font-bold text-amber-800 mt-0.5">
                    ₱{Number(selectedLoanForSchedule.interestEarned).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="text-[11px] text-emerald-700 font-semibold uppercase">Net Disbursed</div>
                  <div className="text-base font-bold text-emerald-800 mt-0.5">
                    ₱{Number(selectedLoanForSchedule.releasedAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
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
                        <th className="py-2.5 px-3 text-right">Remaining Balance</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {schedule.map((item) => (
                        <tr key={item.installmentNumber} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-semibold text-slate-600">{item.installmentNumber}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">
                            <span className="px-2 py-0.5 rounded bg-slate-100 font-bold mr-1.5">
                              {item.cutoffLabel}
                            </span>
                            <span className="text-slate-400">{new Date(item.cutoffDate).toLocaleDateString()}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            ₱{Number(item.scheduledPrincipal).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right text-emerald-700 font-medium">
                            ₱{Number(item.principalPaid).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600 font-medium">
                            ₱{Number(item.remainingBalance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                item.status === "PAID"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : item.status === "OVERDUE"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
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
    </div>
  );
};
