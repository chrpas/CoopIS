import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import {
  BalanceSheet,
  FundReconciliation,
  BankReconciliation,
  CutoffPeriod,
  CreateBankReconPayload,
} from "../../types";
import { useToast } from "../../components/ui/Toast";
import {
  Scale,
  Landmark,
  HandCoins,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building2,
  Plus,
  RefreshCw,
  HelpCircle,
  Receipt,
  Percent,
} from "lucide-react";

export const AccountingPage: React.FC = () => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Active View Tab: Overview & Balance Sheet vs Reconciliations Log
  const [activeTab, setActiveTab] = useState<"balance-sheet" | "reconciliations">("balance-sheet");

  // Reconcile Entry Modal / Drawer State
  const [isReconModalOpen, setIsReconModalOpen] = useState(false);
  const [cutoffId, setCutoffId] = useState<string>("");
  const [statementDate, setStatementDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [cashInBankInput, setCashInBankInput] = useState<string>("");
  const [grossInterestInput, setGrossInterestInput] = useState<string>("");
  const [customTaxInput, setCustomTaxInput] = useState<string>("");
  const [isTaxCustom, setIsTaxCustom] = useState<boolean>(false);
  const [notesInput, setNotesInput] = useState<string>("");

  // 1. Fetch Balance Sheet
  const {
    data: balanceSheet,
    isLoading: isLoadingBS,
    refetch: refetchBS,
    isFetching: isFetchingBS,
  } = useQuery<BalanceSheet>({
    queryKey: ["accounting-balance-sheet"],
    queryFn: async () => {
      const res = await api.get<BalanceSheet>("/accounting/balance-sheet");
      return res.data;
    },
  });

  // 2. Fetch Fund Reconciliation
  const {
    data: fundRecon,
    isLoading: isLoadingFR,
    refetch: refetchFR,
  } = useQuery<FundReconciliation>({
    queryKey: ["accounting-fund-reconciliation"],
    queryFn: async () => {
      const res = await api.get<FundReconciliation>("/accounting/fund-reconciliation");
      return res.data;
    },
  });

  // 3. Fetch Historical Reconciliations
  const {
    data: reconciliations = [],
    isLoading: isLoadingRecons,
  } = useQuery<BankReconciliation[]>({
    queryKey: ["accounting-reconciliations"],
    queryFn: async () => {
      const res = await api.get<BankReconciliation[]>("/accounting/reconciliations");
      return res.data;
    },
  });

  // 4. Fetch Cutoffs for selector in recon modal
  const { data: cutoffs = [] } = useQuery<CutoffPeriod[]>({
    queryKey: ["cutoff-periods"],
    queryFn: async () => {
      const res = await api.get<CutoffPeriod[]>("/cutoff-periods");
      return res.data;
    },
  });

  // Auto-calculation of Withholding Tax (20%) and Net Bank Interest
  const calculatedTax = useMemo(() => {
    const gross = parseFloat(grossInterestInput.replace(/[^0-9.]/g, "")) || 0;
    if (isTaxCustom) {
      return parseFloat(customTaxInput.replace(/[^0-9.]/g, "")) || 0;
    }
    return Math.round(gross * 0.20 * 100) / 100;
  }, [grossInterestInput, isTaxCustom, customTaxInput]);

  const calculatedNetInterest = useMemo(() => {
    const gross = parseFloat(grossInterestInput.replace(/[^0-9.]/g, "")) || 0;
    return Math.max(0, gross - calculatedTax);
  }, [grossInterestInput, calculatedTax]);

  // Submit Bank Reconciliation
  const createReconMutation = useMutation({
    mutationFn: async (payload: CreateBankReconPayload) => {
      const res = await api.post<BankReconciliation>("/accounting/bank-recon", payload);
      return res.data;
    },
    onSuccess: (data) => {
      showToast(
        "success",
        "Bank Reconciliation Recorded",
        `Statement balance ₱${Number(data.cashInBank).toLocaleString()} posted with net interest ₱${Number(
          data.netBankInterest
        ).toLocaleString()}.`
      );
      setIsReconModalOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["accounting-balance-sheet"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-fund-reconciliation"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-reconciliations"] });
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        "Failed to submit bank reconciliation.";
      showToast("error", "Reconciliation Failed", msg);
    },
  });

  const resetForm = () => {
    setCutoffId("");
    setCashInBankInput("");
    setGrossInterestInput("");
    setCustomTaxInput("");
    setIsTaxCustom(false);
    setNotesInput("");
  };

  const handleReconSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cash = parseFloat(cashInBankInput.replace(/[^0-9.]/g, ""));
    const gross = parseFloat(grossInterestInput.replace(/[^0-9.]/g, "")) || 0;

    if (isNaN(cash) || cash < 0) {
      showToast("error", "Validation Error", "Please enter a valid Cash in Bank amount.");
      return;
    }

    createReconMutation.mutate({
      cutoffId: cutoffId || null,
      statementDate: new Date(statementDate).toISOString(),
      cashInBank: cash,
      bankGrossInterest: gross,
      withholdingTax: calculatedTax,
      notes: notesInput.trim() || null,
    });
  };

  const hasVariance = fundRecon && Math.abs(fundRecon.variance) >= 0.01;

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              General Ledger & Fund Reconciliation
            </h2>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Admin Only
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time Statement of Financial Position, Bank Reconciliation, and Total Fund verification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              refetchBS();
              refetchFR();
            }}
            disabled={isFetchingBS}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetchingBS ? "animate-spin text-emerald-600" : ""}`} />
            Refresh Books
          </button>

          <button
            onClick={() => setIsReconModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-all shadow-sm shadow-emerald-900/10"
          >
            <Plus className="w-4 h-4" />
            Post Bank Reconciliation
          </button>
        </div>
      </div>

      {/* 2. Executive Financial Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Fund Equity */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs relative overflow-hidden group hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
              Total Fund Equity
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono tracking-tight">
            ₱{(balanceSheet?.totalEquity || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>Capital ₱{(balanceSheet?.commonShareCapital || 0).toLocaleString()} + Surplus</span>
          </div>
        </div>

        {/* Active Loan Portfolio (Accounts Receivable) */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs relative overflow-hidden group hover:border-blue-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
              Active Loan Portfolio
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <HandCoins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono tracking-tight">
            ₱
            {(balanceSheet?.accountsReceivable || 0).toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-medium">
            Accounts Receivable ({balanceSheet?.activeLoansCount || 0} active loans)
          </div>
        </div>

        {/* Cash in Bank */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs relative overflow-hidden group hover:border-purple-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
              Depository Cash In Bank
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono tracking-tight">
            ₱
            {(balanceSheet?.cashInBank || 0).toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-medium flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>
              {fundRecon?.latestStatementDate
                ? `As of ${new Date(fundRecon.latestStatementDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}`
                : "No statement recorded"}
            </span>
          </div>
        </div>

        {/* Reconciliation Variance with Discrepancy Highlighting */}
        <div
          className={`border p-5 rounded-2xl shadow-xs relative overflow-hidden transition-all ${
            hasVariance
              ? "bg-rose-50/40 border-rose-300 ring-2 ring-rose-200/50"
              : "bg-white border-slate-200 hover:border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
              Reconciliation Variance
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                hasVariance ? "bg-rose-100 text-rose-600" : "bg-emerald-50 text-emerald-600"
              }`}
            >
              {hasVariance ? <AlertTriangle className="w-4 h-4" /> : <Scale className="w-4 h-4" />}
            </div>
          </div>
          <div
            className={`mt-2 text-2xl font-black font-mono tracking-tight ${
              hasVariance ? "text-rose-700" : "text-emerald-700"
            }`}
          >
            ₱
            {Math.abs(fundRecon?.variance || 0).toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </div>
          <div className="mt-1">
            {hasVariance ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300">
                <AlertTriangle className="w-3 h-3" />
                Discrepancy: ₱{Math.abs(fundRecon?.variance || 0).toFixed(2)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 className="w-3 h-3" />
                Balanced & Reconciled
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab("balance-sheet")}
            className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "balance-sheet"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Scale className="w-4 h-4" />
            Statement of Financial Position & Fund Formula
          </button>
          <button
            onClick={() => setActiveTab("reconciliations")}
            className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "reconciliations"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Receipt className="w-4 h-4" />
            Bank Statement Audit Log ({reconciliations.length})
          </button>
        </div>
      </div>

      {activeTab === "balance-sheet" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Statement of Financial Position (Balance Sheet Table) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-emerald-600" />
                  Statement of Financial Position (Balance Sheet)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time co-op assets, liabilities, and common equity accounts.
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-400 bg-white border border-slate-200 px-2 py-1 rounded">
                PHP (₱)
              </span>
            </div>

            {isLoadingBS ? (
              <div className="py-20 text-center">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-500">Computing financial ledger balances...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <tbody>
                    {/* ASSETS SECTION */}
                    <tr className="bg-slate-100/70 border-y border-slate-200">
                      <td colSpan={2} className="py-2.5 px-4 font-black text-xs text-slate-700 uppercase tracking-wider">
                        1. Assets
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100 hover:bg-slate-50/60">
                      <td className="py-3 px-6 text-slate-700">
                        <div className="font-semibold text-slate-800">Cash in Bank</div>
                        <div className="text-xs text-slate-400">Latest reconciled depository balance</div>
                      </td>
                      <td className="py-3 px-6 text-right font-mono font-bold text-slate-900">
                        ₱{(balanceSheet?.cashInBank || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100 hover:bg-slate-50/60">
                      <td className="py-3 px-6 text-slate-700">
                        <div className="font-semibold text-slate-800">Accounts Receivable - Loans</div>
                        <div className="text-xs text-slate-400">Sum of remaining balances across all active loans</div>
                      </td>
                      <td className="py-3 px-6 text-right font-mono font-bold text-slate-900">
                        ₱{(balanceSheet?.accountsReceivable || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr className="bg-emerald-50/30 border-b border-slate-200 font-extrabold text-emerald-950">
                      <td className="py-3 px-4 font-bold text-slate-900">Total Assets</td>
                      <td className="py-3 px-6 text-right font-mono text-base text-emerald-800">
                        ₱{(balanceSheet?.totalAssets || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>

                    {/* LIABILITIES SECTION */}
                    <tr className="bg-slate-100/70 border-y border-slate-200">
                      <td colSpan={2} className="py-2.5 px-4 font-black text-xs text-slate-700 uppercase tracking-wider">
                        2. Liabilities
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100 hover:bg-slate-50/60">
                      <td className="py-3 px-6 text-slate-700">
                        <div className="font-semibold text-slate-800">Salaries & Honoraria Payable</div>
                        <div className="text-xs text-slate-400">5% of Total Distributable Interest (Management Pool)</div>
                      </td>
                      <td className="py-3 px-6 text-right font-mono font-bold text-slate-900">
                        ₱{(balanceSheet?.salariesHonorariaPayable || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <td className="py-3 px-4 font-bold text-slate-900">Total Liabilities</td>
                      <td className="py-3 px-6 text-right font-mono font-bold text-slate-900">
                        ₱{(balanceSheet?.totalLiabilities || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>

                    {/* EQUITY SECTION */}
                    <tr className="bg-slate-100/70 border-y border-slate-200">
                      <td colSpan={2} className="py-2.5 px-4 font-black text-xs text-slate-700 uppercase tracking-wider">
                        3. Member Equity & Capital
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100 hover:bg-slate-50/60">
                      <td className="py-3 px-6 text-slate-700">
                        <div className="font-semibold text-slate-800">Common Share Capital</div>
                        <div className="text-xs text-slate-400">Total cumulative member share contributions</div>
                      </td>
                      <td className="py-3 px-6 text-right font-mono font-bold text-slate-900">
                        ₱{(balanceSheet?.commonShareCapital || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-100 hover:bg-slate-50/60">
                      <td className="py-3 px-6 text-slate-700">
                        <div className="font-semibold text-slate-800">Net Retained Surplus</div>
                        <div className="text-xs text-slate-400">
                          95% of Net Distributable Interest (Dividends & Patronage Pools)
                        </div>
                        {Number(balanceSheet?.totalLatePenalties || 0) > 0 && (
                          <div className="text-[11px] text-amber-700 font-semibold mt-0.5">
                            Includes ₱{Number(balanceSheet?.totalLatePenalties).toLocaleString("en-US", { minimumFractionDigits: 2 })} in collected late penalties
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-6 text-right font-mono font-bold text-slate-900">
                        ₱{(balanceSheet?.netRetainedSurplus || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <td className="py-3 px-4 font-bold text-slate-900">Total Equity</td>
                      <td className="py-3 px-6 text-right font-mono font-bold text-emerald-800">
                        ₱{(balanceSheet?.totalEquity || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>

                    {/* TOTAL LIABILITIES & EQUITY */}
                    <tr className="bg-slate-900 text-white font-extrabold text-sm">
                      <td className="py-3.5 px-4">Total Liabilities & Member Equity</td>
                      <td className="py-3.5 px-6 text-right font-mono text-base text-emerald-400">
                        ₱
                        {(balanceSheet?.totalLiabilitiesAndEquity || 0).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Fund Reconciliation Formula Card (Mirroring 'TOTAL FUND' Sheet) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Fund Reconciliation Formula</h4>
                    <p className="text-[11px] text-slate-400">Mirroring 'TOTAL FUND' audit model</p>
                  </div>
                </div>
              </div>

              {isLoadingFR ? (
                <div className="py-12 text-center text-xs text-slate-400">Calculating fund flow...</div>
              ) : (
                <div className="mt-4 space-y-3 font-mono text-xs">
                  {/* Total Contributions */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                    <span className="text-slate-600 flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">(+)</span> Total Contributions
                    </span>
                    <span className="font-bold text-slate-900">
                      ₱{(fundRecon?.totalContributions || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Loan Receipts with Late Penalties Breakdown */}
                  <div className="p-2 rounded-lg bg-slate-50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 flex items-center gap-1.5">
                        <span className="text-emerald-600 font-bold">(+)</span> Total Loan Receipts
                      </span>
                      <span className="font-bold text-slate-900">
                        ₱{(fundRecon?.totalLoanReceipts || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="pl-5 pr-1 text-[11px] text-slate-500 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span>• Principal Repayments:</span>
                        <span className="font-medium text-slate-700">
                          ₱{(
                            fundRecon?.totalPrincipalRepayments ??
                            Math.max(0, (fundRecon?.totalLoanReceipts || 0) - (fundRecon?.totalLatePenalties || 0))
                          ).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-amber-800 font-semibold">
                        <span>• Late Penalty Revenue:</span>
                        <span>
                          ₱{(fundRecon?.totalLatePenalties || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Net Bank Interest */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                    <span className="text-slate-600 flex items-center gap-1.5">
                      <span className="text-emerald-600 font-bold">(+)</span> Net Bank Interest Earned
                    </span>
                    <span className="font-bold text-slate-900">
                      ₱{(fundRecon?.netBankInterest || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Loan Disbursements */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                    <span className="text-slate-600 flex items-center gap-1.5">
                      <span className="text-rose-600 font-bold">(-)</span> Loan Capital Disbursed
                    </span>
                    <span className="font-bold text-rose-700">
                      ₱{(fundRecon?.totalLoanDisbursements || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Computed Book Balance */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between p-2 rounded-lg bg-slate-100 font-bold">
                    <span className="text-slate-800">(=) Computed Book Balance</span>
                    <span className="text-slate-900 text-sm">
                      ₱{(fundRecon?.bookBalance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Depository Cash in Bank */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                    <span className="text-slate-600 flex items-center gap-1.5">
                      <span className="text-slate-400 font-bold">(-)</span> Actual Cash in Bank
                    </span>
                    <span className="font-bold text-slate-900">
                      ₱{(fundRecon?.cashInBank || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Net Variance */}
                  <div
                    className={`pt-2 border-t border-slate-200 flex items-center justify-between p-2.5 rounded-lg font-bold ${
                      hasVariance ? "bg-rose-100 text-rose-950 border border-rose-300" : "bg-emerald-100 text-emerald-950"
                    }`}
                  >
                    <span>(=) Fund Variance</span>
                    <span className="text-sm">
                      ₱{(fundRecon?.variance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Explanatory Policy Callout */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Statutory Surplus & Liability Distribution</span>
              </div>
              <p className="leading-relaxed">
                In compliance with Philippine cooperative financial policies, 5% of Total Distributable Interest is allocated to Salaries / Honoraria Payable (Liabilities), while the remaining 95% constitutes Net Retained Surplus for member dividend and patronage distribution.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* 4. Bank Statement Audit Log Table */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 bg-slate-50/70 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-emerald-600" />
                Historical Bank Statement Reconciliations
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Depository bank ledger records with gross interest and withholding tax breakdown.
              </p>
            </div>
            <button
              onClick={() => setIsReconModalOpen(true)}
              className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> New Statement
            </button>
          </div>

          {isLoadingRecons ? (
            <div className="p-12 text-center text-sm text-slate-500">Loading audit records...</div>
          ) : reconciliations.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              No bank reconciliation records found. Click 'Post Bank Reconciliation' to create the first record.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Statement Date</th>
                    <th className="py-3 px-4">Cutoff Period</th>
                    <th className="py-3 px-4 text-right">Cash in Bank</th>
                    <th className="py-3 px-4 text-right">Gross Interest</th>
                    <th className="py-3 px-4 text-right">Tax (20%)</th>
                    <th className="py-3 px-4 text-right">Net Interest</th>
                    <th className="py-3 px-4 text-center">Variance Audit</th>
                    <th className="py-3 px-4">Audit Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reconciliations.map((r) => {
                    const isBalanced = Math.abs(Number(r.reconciledVariance)) < 0.01;
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            {new Date(r.statementDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {r.cutoffLabel ? (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-xs font-mono font-semibold">
                              {r.cutoffLabel}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                          ₱{Number(r.cashInBank).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-indigo-700 font-medium">
                          ₱{Number(r.bankGrossInterest).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-rose-600 font-medium">
                          ₱{Number(r.withholdingTax).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-emerald-700 font-bold">
                          ₱{Number(r.netBankInterest).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isBalanced ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              ₱0.00 (Balanced)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                              ₱{Number(r.reconciledVariance).toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500 max-w-xs truncate">
                          {r.notes || "Reconciled depository statement"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. Bank Reconciliation Entry Modal */}
      {isReconModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Post Bank Statement Reconciliation</h3>
                  <p className="text-xs text-slate-500">Record statement cash balance, gross interest, and tax.</p>
                </div>
              </div>
              <button
                onClick={() => setIsReconModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReconSubmit} className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                {/* Statement Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Statement Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={statementDate}
                    onChange={(e) => setStatementDate(e.target.value)}
                    className="w-full text-xs font-medium px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>

                {/* Fiscal Cutoff Period (Optional) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Cutoff Period
                  </label>
                  <select
                    value={cutoffId}
                    onChange={(e) => setCutoffId(e.target.value)}
                    className="w-full text-xs font-medium px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  >
                    <option value="">Unassigned</option>
                    {cutoffs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label} ({c.fiscalYear})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cash in Bank */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Cash in Bank (₱) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₱</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={cashInBankInput}
                    onChange={(e) => setCashInBankInput(e.target.value)}
                    className="w-full font-mono font-bold text-slate-900 pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Exact ending balance printed on official bank statement.</p>
              </div>

              {/* Gross Interest & Withholding Tax */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Bank Gross Interest (₱)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₱</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={grossInterestInput}
                      onChange={(e) => setGrossInterestInput(e.target.value)}
                      className="w-full font-mono text-xs pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Tax (20% WHT)
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsTaxCustom(!isTaxCustom)}
                      className="text-[10px] text-indigo-600 hover:underline"
                    >
                      {isTaxCustom ? "Auto 20%" : "Custom"}
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₱</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={!isTaxCustom}
                      placeholder="0.00"
                      value={isTaxCustom ? customTaxInput : calculatedTax > 0 ? calculatedTax : ""}
                      onChange={(e) => setCustomTaxInput(e.target.value)}
                      className={`w-full font-mono text-xs pl-7 pr-3 py-2 border rounded-xl focus:outline-none ${
                        isTaxCustom
                          ? "bg-white border-slate-200"
                          : "bg-slate-50 border-slate-200 text-slate-600 cursor-not-allowed"
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Net Interest Calculation Box */}
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-950 flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-emerald-600" />
                  Auto-calculated Net Bank Interest:
                </span>
                <span className="font-mono font-bold text-emerald-800 text-sm">
                  ₱{calculatedNetInterest.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Audit Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Audit Notes & Reference
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g., LandBank Checking Account - Statement Ref #LB-2026-001"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsReconModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createReconMutation.isPending}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm shadow-emerald-900/10 flex items-center gap-2"
                >
                  {createReconMutation.isPending ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Posting...
                    </>
                  ) : (
                    "Confirm & Post Statement"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountingPage;
