import React, { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Member } from "../../types";
import {
  calculateLoanTerms,
  projectAmortizationSchedule,
  MIN_LOAN_AMOUNT,
  MAX_LOAN_AMOUNT,
  ProjectedAmortizationItem,
} from "../../lib/services/loan-service";
import {
  X,
  User,
  Calculator,
  Calendar,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  Percent,
  Sparkles,
  ShieldCheck,
  CreditCard,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";


interface LoanOriginationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
}

export const LoanOriginationWizard: React.FC<LoanOriginationWizardProps> = ({
  isOpen,
  onClose,
  members,
}) => {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [memberId, setMemberId] = useState<string>("");
  const [principalAmount, setPrincipalAmount] = useState<number>(20000);
  const [loanReference, setLoanReference] = useState<string>(
    `LN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [notes, setNotes] = useState<string>("");

  // Live calculation of loan terms
  const calculation = useMemo(() => {
    return calculateLoanTerms(principalAmount);
  }, [principalAmount]);

  // Live projected amortization schedule
  const schedule = useMemo<ProjectedAmortizationItem[]>(() => {
    return projectAmortizationSchedule(principalAmount, new Date());
  }, [principalAmount]);

  // Selected member object
  const selectedMember = useMemo(() => {
    return members.find((m) => m.id === memberId);
  }, [members, memberId]);

  // Quick preset amounts
  const presetAmounts = [5000, 15000, 25000, 35000, 50000, 70000, 80000];

  const originateMutation = useMutation({
    mutationFn: async () => {
      if (!memberId) {
        throw new Error("Please select a borrower member.");
      }
      return await api.post("/loans", {
        loanReference,
        memberId,
        originationDate: new Date().toISOString(),
        principalAmount: calculation.principalAmount,
        interestRate: calculation.interestRate,
        termMonths: calculation.termMonths,
        cutoffsCount: calculation.cutoffsCount,
        notes: notes || `Originated via Wizard (${calculation.tierDescription})`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      onClose();
      // Reset state
      setStep(1);
      setErrorMsg(null);
      setLoanReference(`LN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
      setNotes("");
    },
    onError: (err: unknown) => {
      const errorResponse = err as { response?: { data?: { message?: string } }; message?: string };
      setErrorMsg(errorResponse?.response?.data?.message || errorResponse?.message || "Failed to persist loan.");
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Wizard Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">Loan Origination Wizard</h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  5% Upfront Policy
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Automated term tiering, upfront interest deduction, and bi-monthly cutoff scheduling
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Stepper Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-medium text-slate-500">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setStep(1)}
              className={`flex items-center gap-2 transition-colors ${
                step === 1 ? "text-emerald-700 font-bold" : "hover:text-slate-800"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 1
                    ? "bg-emerald-600 text-white"
                    : selectedMember
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                1
              </span>
              <span>1. Borrower Selection</span>
            </button>
            <ChevronRight className="w-4 h-4 text-slate-300" />
            <button
              onClick={() => {
                if (memberId) setStep(2);
              }}
              disabled={!memberId}
              className={`flex items-center gap-2 transition-colors ${
                step === 2 ? "text-emerald-700 font-bold" : "hover:text-slate-800 disabled:opacity-40"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 2
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                2
              </span>
              <span>2. Amount & Tier Calculator</span>
            </button>
            <ChevronRight className="w-4 h-4 text-slate-300" />
            <button
              onClick={() => {
                if (memberId) setStep(3);
              }}
              disabled={!memberId}
              className={`flex items-center gap-2 transition-colors ${
                step === 3 ? "text-emerald-700 font-bold" : "hover:text-slate-800 disabled:opacity-40"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 3
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                3
              </span>
              <span>3. Amortization Schedule & Persist</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Wizard Content Body */}
        <div className="p-6">
          {/* STEP 1: BORROWER SELECTION */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Registered Borrower Member
                </label>
                <div className="relative">
                  <select
                    value={memberId}
                    onChange={(e) => {
                      setMemberId(e.target.value);
                      setErrorMsg(null);
                    }}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  >
                    <option value="">-- Choose Member from Registry --</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.firstName} {m.lastName} • [{m.memberCode}] — {m.status}
                      </option>
                    ))}
                  </select>
                  <User className="w-5 h-5 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                </div>
              </div>

              {selectedMember && (
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800 font-bold text-base flex-shrink-0">
                    {selectedMember.firstName[0]}
                    {selectedMember.lastName[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 text-sm">
                        {selectedMember.firstName} {selectedMember.lastName}
                      </h4>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-200 text-emerald-800">
                        {selectedMember.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-slate-600">
                      <div>
                        <span className="text-slate-400">Member Code: </span>
                        <span className="font-semibold text-slate-800">{selectedMember.memberCode}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Email: </span>
                        <span className="font-semibold text-slate-800">{selectedMember.email}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Cooperative Policy Validation
                </h4>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                  <li>Member must hold an active account with verified share capital standing.</li>
                  <li>Lending ceiling capped at ₱80,000 PHP per cooperative bylaws.</li>
                  <li>Flat 5.00% interest deducted upfront from gross proceeds.</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 2: AMOUNT INPUT & LIVE TIER CALCULATION */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Amount Input with presets */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Requested Principal Amount (PHP)
                  </label>
                  <span className="text-xs font-bold text-emerald-700">
                    ₱{principalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="relative">
                  <div className="absolute left-3.5 top-3 text-slate-400 font-bold text-lg">₱</div>
                  <input
                    type="number"
                    step="500"
                    min={MIN_LOAN_AMOUNT}
                    max={MAX_LOAN_AMOUNT}
                    value={principalAmount}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPrincipalAmount(val);
                    }}
                    className="w-full pl-9 pr-4 py-3 text-xl font-bold bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-900"
                  />
                </div>

                {/* Range Slider */}
                <div className="mt-3">
                  <input
                    type="range"
                    min={MIN_LOAN_AMOUNT}
                    max={MAX_LOAN_AMOUNT}
                    step="500"
                    value={principalAmount}
                    onChange={(e) => setPrincipalAmount(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                    <span>₱1,000 (Min)</span>
                    <span>₱40,000</span>
                    <span>₱80,000 (Max Limit)</span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-xs text-slate-400 flex items-center mr-1">Quick Select:</span>
                  {presetAmounts.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setPrincipalAmount(amt)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all ${
                        principalAmount === amt
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      }`}
                    >
                      ₱{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Tier Matrix Card */}
              <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl text-white shadow-md">
                <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                      Matched Tiering Rule
                    </span>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {calculation.tierDescription}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-2.5 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-[11px] text-slate-400 uppercase font-medium">Repayment Term</div>
                    <div className="text-base font-bold text-white mt-0.5">{calculation.termMonths} Months</div>
                  </div>
                  <div className="p-2.5 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-[11px] text-slate-400 uppercase font-medium">Bi-Monthly Cutoffs</div>
                    <div className="text-base font-bold text-emerald-400 mt-0.5">{calculation.cutoffsCount} Periods</div>
                  </div>
                  <div className="p-2.5 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-[11px] text-slate-400 uppercase font-medium">Upfront Interest</div>
                    <div className="text-base font-bold text-amber-400 mt-0.5">5.00% (Flat)</div>
                  </div>
                  <div className="p-2.5 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-[11px] text-slate-400 uppercase font-medium">Payment / Cutoff</div>
                    <div className="text-base font-bold text-white mt-0.5">
                      ₱{calculation.cutoffPaymentAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Calculation Breakdown Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[11px] text-slate-500 font-semibold uppercase flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-slate-600" />
                    Gross Principal
                  </div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    ₱{calculation.principalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Total payable by borrower</div>
                </div>

                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl">
                  <div className="text-[11px] text-amber-800 font-semibold uppercase flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-amber-600" />
                    Upfront Interest (5%)
                  </div>
                  <div className="text-lg font-bold text-amber-900 mt-1">
                    ₱{calculation.interestEarned.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-amber-700 mt-0.5">Retained as coop interest</div>
                </div>

                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl shadow-xs">
                  <div className="text-[11px] text-emerald-800 font-semibold uppercase flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                    Net Disbursed Payout
                  </div>
                  <div className="text-lg font-extrabold text-emerald-700 mt-1">
                    ₱{calculation.releasedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-emerald-600 mt-0.5">Check / Cash disbursement</div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: AMORTIZATION SCHEDULE PREVIEW & SERVER PERSISTENCE */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Summary Banner */}
              <div className="p-4 bg-emerald-900 text-white rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-md">
                <div>
                  <div className="text-xs text-emerald-300 font-semibold uppercase tracking-wider">
                    Borrower: {selectedMember?.firstName} {selectedMember?.lastName} ({selectedMember?.memberCode})
                  </div>
                  <div className="text-xl font-bold mt-0.5">
                    ₱{calculation.principalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} Principal •{" "}
                    {calculation.cutoffsCount} Semi-Monthly Cutoffs
                  </div>
                </div>
                <div className="text-right sm:border-l sm:border-emerald-700 sm:pl-4">
                  <div className="text-xs text-emerald-300">Bi-Monthly Payroll Deduction</div>
                  <div className="text-xl font-extrabold text-emerald-300">
                    ₱{calculation.cutoffPaymentAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Reference and Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Loan Reference Code
                  </label>
                  <input
                    type="text"
                    required
                    value={loanReference}
                    onChange={(e) => setLoanReference(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Application Purpose / Notes
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Educational, Emergency, or Livelihood"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Projected Amortization Schedule Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    Projected Semi-Monthly Amortization Schedule ({schedule.length} Cutoffs)
                  </h4>
                  <span className="text-[11px] text-slate-400">15th and End of Month Deductions</span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Cutoff Period</th>
                        <th className="py-2.5 px-3 text-right">Scheduled Principal</th>
                        <th className="py-2.5 px-3 text-right">Upfront Int.</th>
                        <th className="py-2.5 px-3 text-right">Remaining Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {schedule.map((row) => (
                        <tr key={row.installmentNumber} className="hover:bg-slate-50/60">
                          <td className="py-2 px-3 font-semibold text-slate-700">{row.installmentNumber}</td>
                          <td className="py-2 px-3 font-medium text-slate-900">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold mr-1.5">
                              {row.cutoffLabel}
                            </span>
                            <span className="text-slate-400">{new Date(row.cutoffDate).toLocaleDateString()}</span>
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            ₱{row.scheduledPrincipal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-right text-amber-700 font-medium">
                            {row.scheduledInterestUpfront > 0
                              ? `₱${row.scheduledInterestUpfront.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                              : "—"}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600 font-medium">
                            ₱{row.remainingPrincipal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as 1 | 2)}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous Step
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>

            {step < 3 ? (
              <button
                type="button"
                disabled={step === 1 && !memberId}
                onClick={() => {
                  if (step === 1 && !memberId) {
                    setErrorMsg("Please select a borrower member first.");
                    return;
                  }
                  setErrorMsg(null);
                  setStep((s) => (s + 1) as 2 | 3);
                }}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-40"
              >
                Continue to {step === 1 ? "Tier Calculator" : "Amortization Schedule"}
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={originateMutation.isPending}
                onClick={() => originateMutation.mutate()}
                className="inline-flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow-sm transition-all hover:shadow-md disabled:opacity-50"
              >
                {originateMutation.isPending ? (
                  "Persisting Loan & Scheduling..."
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Originate & Schedule Loan
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
