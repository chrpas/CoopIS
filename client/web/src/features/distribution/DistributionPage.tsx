import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import {
  DistributionPreview,
  MemberAllocation,
  MemberStatementOfAccount,
} from "../../types";
import { useToast } from "../../components/ui/Toast";
import {
  PieChart,
  CheckCircle,
  Download,
  Printer,
  X,
  Search,
  ArrowUpDown,
  Building2,
  Lock,
  TrendingUp,
  Percent,
  Receipt,
  FileText,
  BadgeAlert,
} from "lucide-react";

export const DistributionPage: React.FC = () => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Selected Fiscal Year (defaults to 2026)
  const [fiscalYear, setFiscalYear] = useState<number>(2026);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);

  // Table sorting & filtering
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortField, setSortField] = useState<keyof MemberAllocation>("netSavingsCredited");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Two-step Finalize Confirmation Dialog
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState<boolean>(false);
  const [confirmCheckbox, setConfirmCheckbox] = useState<boolean>(false);

  // Statement of Account (SOA) Modal
  const [selectedSoaMemberId, setSelectedSoaMemberId] = useState<string | null>(null);

  // 1. Fetch Distribution Preview
  const {
    data: preview,
    isLoading: isLoadingPreview,
  } = useQuery<DistributionPreview>({
    queryKey: ["distribution-preview", fiscalYear],
    queryFn: async () => {
      const res = await api.get<DistributionPreview>(`/distribution/preview/${fiscalYear}`);
      return res.data;
    },
  });

  // 2. Fetch Selected Member SOA when modal is open
  const {
    data: soaData,
    isLoading: isLoadingSoa,
  } = useQuery<MemberStatementOfAccount>({
    queryKey: ["member-soa", selectedSoaMemberId, fiscalYear],
    queryFn: async () => {
      if (!selectedSoaMemberId) throw new Error("No member selected");
      const res = await api.get<MemberStatementOfAccount>(
        `/distribution/member/${selectedSoaMemberId}/soa?fiscalYear=${fiscalYear}`
      );
      return res.data;
    },
    enabled: !!selectedSoaMemberId,
  });

  // 3. Finalize Distribution Mutation
  const finalizeMutation = useMutation({
    mutationFn: async (year: number) => {
      const res = await api.post<DistributionPreview>(`/distribution/finalize/${year}`);
      return res.data;
    },
    onSuccess: (data) => {
      showToast(
        "success",
        "Fiscal Year Finalized & Credited",
        `Successfully closed FY ${data.fiscalYear}. All 24 cutoffs locked and member ledgers credited.`
      );
      setIsFinalizeModalOpen(false);
      setConfirmCheckbox(false);
      queryClient.invalidateQueries({ queryKey: ["distribution-preview", fiscalYear] });
      queryClient.invalidateQueries({ queryKey: ["cutoff-periods"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-balance-sheet"] });
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        "Failed to finalize surplus distribution.";
      showToast("error", "Finalization Failed", msg);
    },
  });

  // Handle Sort Toggle
  const handleSort = (field: keyof MemberAllocation) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Filtered & Sorted Allocations
  const filteredAllocations = useMemo(() => {
    if (!preview?.allocations) return [];
    let list = [...preview.allocations];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (a) =>
          a.memberName.toLowerCase().includes(term) ||
          a.memberCode.toLowerCase().includes(term) ||
          a.email.toLowerCase().includes(term)
      );
    }

    list.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];

      if (typeof valA === "number" && typeof valB === "number") {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });

    return list;
  }, [preview?.allocations, searchTerm, sortField, sortAsc]);

  // Step 3: Export Preview to CSV
  const handleExportCsv = () => {
    if (!preview || !preview.allocations.length) return;

    const headers = [
      "Member ID",
      "Member Name",
      "Email",
      "Total Contribution (PHP)",
      "Contribution Ratio",
      "Dividend Earned (PHP)",
      "Total Borrowing Volume (PHP)",
      "Loan Ratio",
      "Patronage Refund (PHP)",
      "Total Surplus Earned (PHP)",
      "Net Credited Savings (PHP)",
    ];

    const rows = preview.allocations.map((a) => [
      `"${a.memberCode}"`,
      `"${a.memberName}"`,
      `"${a.email}"`,
      a.totalContribution.toFixed(2),
      a.contributionRatio.toFixed(8),
      a.dividendEarned.toFixed(2),
      a.totalLoansBorrowed.toFixed(2),
      a.loanRatio.toFixed(8),
      a.patronageEarned.toFixed(2),
      a.totalSurplusEarned.toFixed(2),
      a.netSavingsCredited.toFixed(2),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CoopIS_FY${fiscalYear}_Surplus_Distribution_Preview.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("success", "CSV Export Complete", "Surplus allocation preview exported successfully.");
  };

  // Trigger Print for SOA
  const handlePrintSoa = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Fiscal Year Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Fiscal Year-End Surplus Distribution & Patronage Refund
            </h2>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Admin Only
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Statutory net surplus partitioning: 65% Dividend, 30% Patronage Refund, 5% Management Reserve.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3.5 py-1.5 rounded-xl shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Fiscal Year:
            </span>
            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
              className="text-sm font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value={2026}>FY 2026</option>
              <option value={2025}>FY 2025</option>
              <option value={2024}>FY 2024</option>
            </select>
            {preview?.isAlreadyFinalized ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                <Lock className="w-3 h-3 text-slate-500" /> Finalized & Closed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                <CheckCircle className="w-3 h-3 text-emerald-600" /> Draft / Open
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Fiscal Year-End Closeout Wizard Navigation Steps */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
            <button
              onClick={() => setWizardStep(1)}
              className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                wizardStep === 1
                  ? "bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-xs"
                  : "bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                  wizardStep === 1 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                1
              </div>
              <div>
                <div className="text-xs font-bold">Review Pools</div>
                <div className="text-[10px] text-slate-500">65 / 30 / 5 Split</div>
              </div>
            </button>

            <button
              onClick={() => setWizardStep(2)}
              className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                wizardStep === 2
                  ? "bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-xs"
                  : "bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                  wizardStep === 2 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                2
              </div>
              <div>
                <div className="text-xs font-bold">Member Allocations</div>
                <div className="text-[10px] text-slate-500">Interactive Preview</div>
              </div>
            </button>

            <button
              onClick={() => {
                setWizardStep(3);
                handleExportCsv();
              }}
              className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                wizardStep === 3
                  ? "bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-xs"
                  : "bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                  wizardStep === 3 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                3
              </div>
              <div>
                <div className="text-xs font-bold">Export Preview</div>
                <div className="text-[10px] text-slate-500">Excel / CSV Format</div>
              </div>
            </button>

            <button
              onClick={() => setWizardStep(4)}
              className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                wizardStep === 4
                  ? "bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-xs"
                  : "bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                  wizardStep === 4 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                4
              </div>
              <div>
                <div className="text-xs font-bold">Finalize Closeout</div>
                <div className="text-[10px] text-slate-500">Commit & Lock Cutoffs</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {isLoadingPreview ? (
        <div className="py-20 text-center bg-white border border-slate-200 rounded-2xl">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">
            Simulating fiscal year-end surplus distribution engine...
          </p>
        </div>
      ) : (
        <>
          {/* STEP 1: REVIEW AGGREGATE POOLS */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <PieChart className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Step 1: Total Distributable Interest & Pool Breakdown
                    </h3>
                    <p className="text-xs text-slate-500">
                      Sum of upfront loan interest, late penalties, and net bank interest.
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs uppercase font-bold text-slate-400">Total Net Distributable</span>
                  <div className="text-2xl font-black font-mono text-slate-900">
                    ₱
                    {(preview?.totalDistributableInterest || 0).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                </div>
              </div>

              {/* 3 Pool Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
                {/* 65% Dividend Pool */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      General Dividend (65%)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                      Capital Build-Up
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-950 mt-1">
                    ₱{(preview?.dividendPool || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-emerald-700 mt-2 leading-relaxed">
                    Distributed pro-rata based on member share capital contributions.
                  </p>
                </div>

                {/* 30% Patronage Pool */}
                <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-5 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-blue-600" />
                      Patronage Refund (30%)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-200 text-blue-900">
                      Borrowing Volume
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-blue-950 mt-1">
                    ₱{(preview?.patronagePool || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-blue-700 mt-2 leading-relaxed">
                    Refunded pro-rata to borrowing members based on loan volume patronized.
                  </p>
                </div>

                {/* 5% Management Pool */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Percent className="w-4 h-4 text-slate-500" />
                      Management / Honoraria (5%)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                      Reserve & Admin
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-slate-900 mt-1">
                    ₱{(preview?.managementPool || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Allocated to cooperative committee honoraria and statutory reserves.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 2: INTERACTIVE MEMBER ALLOCATION PREVIEW TABLE */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  Step 2: Member Allocation Preview & Pro-Rata Credits
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click headers to sort. Select 'View SOA' to print individual member vouchers.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search member name or code..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full text-xs font-medium pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>

                <button
                  onClick={handleExportCsv}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl transition-colors shadow-xs"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  Export CSV
                </button>

                {!preview?.isAlreadyFinalized && (
                  <button
                    onClick={() => setIsFinalizeModalOpen(true)}
                    className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 rounded-xl transition-all shadow-sm"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Finalize FY {fiscalYear}
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Member</th>
                    <th
                      onClick={() => handleSort("totalContribution")}
                      className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Total Capital (₱)
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("dividendEarned")}
                      className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Dividend (65%)
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("totalLoansBorrowed")}
                      className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Loan Volume (₱)
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("patronageEarned")}
                      className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Patronage (30%)
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("netSavingsCredited")}
                      className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                    >
                      <div className="flex items-center justify-end gap-1 font-bold text-emerald-800">
                        Net Savings Credited
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAllocations.map((a) => (
                    <tr key={a.memberId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{a.memberName}</div>
                        <div className="text-xs font-mono text-slate-400">{a.memberCode}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-800">
                        ₱{a.totalContribution.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        <div className="text-[10px] text-slate-400">
                          {(a.contributionRatio * 100).toFixed(2)}% share
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                        ₱{a.dividendEarned.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-800">
                        ₱{a.totalLoansBorrowed.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        <div className="text-[10px] text-slate-400">
                          {(a.loanRatio * 100).toFixed(2)}% volume
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-blue-700">
                        ₱{a.patronageEarned.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-800 text-sm">
                        ₱{a.netSavingsCredited.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setSelectedSoaMemberId(a.memberId)}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                        >
                          <FileText className="w-3 h-3 text-slate-500" />
                          View SOA
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500 gap-2">
              <div>
                Showing <span className="font-bold text-slate-800">{filteredAllocations.length}</span> member allocations for FY {fiscalYear}.
              </div>
              <div className="flex items-center gap-3">
                <span>
                  Total Surplus Credited:{" "}
                  <span className="font-mono font-bold text-emerald-700">
                    ₱
                    {(
                      (preview?.dividendPool || 0) + (preview?.patronagePool || 0)
                    ).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 3. STEP 4: TWO-STEP FINALIZE CONFIRMATION MODAL */}
      {isFinalizeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <BadgeAlert className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Confirm Year-End Finalization</h3>
                  <p className="text-xs text-slate-500">Fiscal Year {fiscalYear} Closeout</p>
                </div>
              </div>
              <button
                onClick={() => setIsFinalizeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-600 leading-relaxed">
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-medium">
                Warning: This action is permanent and legally binding under cooperative law.
              </div>
              <p>By confirming this closeout:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-700 font-medium">
                <li>All 24 semi-monthly payroll cutoffs for FY {fiscalYear} will be marked CLOSED.</li>
                <li>Dividend and Patronage balances will be permanently committed to member ledgers.</li>
                <li>Net Credited Savings will update each member's official Statement of Account.</li>
              </ul>

              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmCheckbox}
                    onChange={(e) => setConfirmCheckbox(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    I verify that the audit reconciliations and board resolutions have approved the FY {fiscalYear} distributions.
                  </span>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFinalizeModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!confirmCheckbox || finalizeMutation.isPending}
                  onClick={() => finalizeMutation.mutate(fiscalYear)}
                  className={`px-5 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-sm flex items-center gap-2 ${
                    confirmCheckbox && !finalizeMutation.isPending
                      ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20"
                      : "bg-slate-300 cursor-not-allowed"
                  }`}
                >
                  {finalizeMutation.isPending ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Committing Closeout...
                    </>
                  ) : (
                    "Finalize & Credit Accounts"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. INDIVIDUAL STATEMENT OF ACCOUNT (SOA) PRINTABLE MODAL */}
      {selectedSoaMemberId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            {/* Top Modal Controls (Hidden in Print) */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between print:hidden">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Official Statement of Account & Patronage Voucher
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintSoa}
                  className="flex items-center gap-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 px-3.5 py-1.5 rounded-xl transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / Save as PDF
                </button>
                <button
                  onClick={() => setSelectedSoaMemberId(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Statement Document */}
            {isLoadingSoa ? (
              <div className="py-24 text-center">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-500 font-medium">Generating official member statement...</p>
              </div>
            ) : soaData ? (
              <div id="soa-printable-voucher" className="p-8 text-slate-900 space-y-6">
                {/* Header */}
                <div className="text-center border-b pb-4 border-slate-200">
                  <div className="font-extrabold text-xl tracking-tight uppercase text-emerald-800">
                    Cooperative Information System (CoopIS)
                  </div>
                  <div className="text-xs text-slate-500">
                    Republic of the Philippines • Cooperative Financial Board
                  </div>
                  <div className="text-sm font-bold mt-2 uppercase tracking-wider text-slate-800">
                    Annual Statement of Account & Patronage Certificate
                  </div>
                  <div className="text-xs text-slate-400">Fiscal Year {soaData.fiscalYear}</div>
                </div>

                {/* Member Profile */}
                <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-400 uppercase font-semibold">Member Name:</span>
                    <div className="font-bold text-sm text-slate-900">{soaData.memberName}</div>
                    <div className="font-mono text-slate-500">{soaData.memberCode}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 uppercase font-semibold">Issue Date:</span>
                    <div className="font-medium text-slate-800">
                      {new Date(soaData.asOfDate).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {soaData.isFinalized ? "Final Audited Ledger" : "Provisional Statement"}
                    </span>
                  </div>
                </div>

                {/* Surplus Distribution Breakdown */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                    1. Surplus & Patronage Entitlement
                  </div>
                  <div className="p-4 grid grid-cols-3 gap-4 text-center text-xs">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <div className="text-slate-500 font-medium">Contribution Capital</div>
                      <div className="font-mono font-bold text-sm text-slate-900 mt-1">
                        ₱{soaData.totalContributions.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Ratio: {(soaData.contributionRatio * 100).toFixed(4)}%
                      </div>
                    </div>

                    <div className="p-3 bg-emerald-50 rounded-lg">
                      <div className="text-emerald-800 font-medium">Dividend (65%)</div>
                      <div className="font-mono font-bold text-sm text-emerald-900 mt-1">
                        ₱{soaData.dividendEarned.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-emerald-600">Capital Build-up</div>
                    </div>

                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="text-blue-800 font-medium">Patronage Refund (30%)</div>
                      <div className="font-mono font-bold text-sm text-blue-900 mt-1">
                        ₱{soaData.patronageEarned.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-blue-600">Borrowing Volume</div>
                    </div>
                  </div>
                </div>

                {/* Total Payout Summary */}
                <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                      Total Net Credited Savings
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Capital (₱{soaData.totalContributions.toLocaleString()}) + Surplus (₱{soaData.totalSurplusEarned.toLocaleString()})
                    </div>
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-400">
                    ₱{soaData.netSavingsCredited.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Authorized Signatures */}
                <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs border-t border-slate-200">
                  <div>
                    <div className="border-b border-slate-400 w-44 mx-auto mb-1"></div>
                    <div className="font-bold text-slate-900">Cooperative Treasurer</div>
                    <div className="text-slate-400">Audit & Disbursement</div>
                  </div>
                  <div>
                    <div className="border-b border-slate-400 w-44 mx-auto mb-1"></div>
                    <div className="font-bold text-slate-900">Chairperson of the Board</div>
                    <div className="text-slate-400">Executive Endorsement</div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default DistributionPage;
