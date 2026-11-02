import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Loan, Member, LoanStatus, AmortizationScheduleItem } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { LoanOriginationWizard } from "./LoanOriginationWizard";
import { AmortizationScheduleModal } from "./AmortizationScheduleModal";
import { RecordRepaymentModal } from "./RecordRepaymentModal";
import { LoanPenaltiesModal } from "./LoanPenaltiesModal";
import {
  Plus,
  CheckCircle,
  Clock,
  FileText,
  Calendar,
  Ban,
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
  const { data: schedule = [] } = useQuery<AmortizationScheduleItem[]>({
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

      {/* Detailed Amortization Schedule & Repayment Engine Modal */}
      <AmortizationScheduleModal
        loan={selectedLoanForSchedule}
        isOpen={Boolean(selectedLoanForSchedule)}
        onClose={() => setSelectedLoanForSchedule(null)}
        onOpenPenaltiesAudit={() => setIsPenaltiesModalOpen(true)}
      />

      {/* Record Repayment Modal (for penalties audit pay button fallback) */}
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
