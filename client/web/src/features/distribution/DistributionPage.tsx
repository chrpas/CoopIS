import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import {
  CarryoverMode,
  CutoffPeriod,
  DistributionPreview,
  MemberAllocation,
  MemberStatementOfAccount,
  UpdateMemberCarryoverRequest,
} from "../../types";
import { useToast } from "../../components/ui/Toast";
import { TablePagination, DEFAULT_PAGE_SIZE } from "../../components/ui/TablePagination";
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
  UserCheck,
  Wallet,
  HandCoins,
  RefreshCw,
  AlertTriangle,
  Banknote,
  SlidersHorizontal,
} from "lucide-react";

export const DistributionPage: React.FC = () => {
  const { user } = useAuth();
  const isMember = user?.role === "Member";
  const isAdmin = user?.role === "Admin";
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Selected Fiscal Year (defaults to 2026)
  const [fiscalYear, setFiscalYear] = useState<number>(2026);

  // Table sorting & filtering
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortField, setSortField] = useState<keyof MemberAllocation>("netSavingsCredited");
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  // Two-step Finalize Confirmation Dialog
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState<boolean>(false);
  const [confirmCheckbox, setConfirmCheckbox] = useState<boolean>(false);

  // Carryover Election Modal state
  const [carryoverMember, setCarryoverMember] = useState<MemberAllocation | null>(null);
  const [selectedMode, setSelectedMode] = useState<CarryoverMode>("None");
  const [carryCapital, setCarryCapital] = useState<boolean>(false);
  const [carryDividend, setCarryDividend] = useState<boolean>(false);
  const [carryPatronage, setCarryPatronage] = useState<boolean>(false);
  const [customAmountInput, setCustomAmountInput] = useState<string>("");

  // Statement of Account (SOA) Modal
  const [selectedSoaMemberId, setSelectedSoaMemberId] = useState<string | null>(null);

  // Fetch Cutoff Periods to derive all available Fiscal Years
  const { data: cutoffs = [] } = useQuery<CutoffPeriod[]>({
    queryKey: ["cutoff-periods"],
    queryFn: async () => {
      const res = await api.get<CutoffPeriod[]>("/cutoff-periods");
      return res.data;
    },
  });

  const availableFiscalYears = useMemo(() => {
    const yearsSet = new Set<number>([2026, 2025, 2024]);
    cutoffs.forEach((c) => yearsSet.add(c.fiscalYear));
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [cutoffs]);

  // 1. Fetch Distribution Preview
  const {
    data: preview,
    isLoading: isLoadingPreview,
  } = useQuery<DistributionPreview>({
    queryKey: ["distribution-preview", fiscalYear, user?.role, user?.memberId],
    queryFn: async () => {
      const res = await api.get<DistributionPreview>(`/distribution/preview/${fiscalYear}`);
      return res.data;
    },
  });

  // Logged-in member's personal allocation (backend already scopes preview.allocations to the logged-in member for Member role)
  const myAllocation = useMemo<MemberAllocation | null>(() => {
    if (!preview?.allocations || preview.allocations.length === 0) return null;
    if (user?.memberId) {
      const byId = preview.allocations.find((a) => a.memberId === user.memberId);
      if (byId) return byId;
    }
    if (user?.memberCode) {
      const byCode = preview.allocations.find(
        (a) => a.memberCode.toLowerCase() === user.memberCode?.toLowerCase()
      );
      if (byCode) return byCode;
    }
    return preview.allocations[0] || null;
  }, [preview?.allocations, user?.memberId, user?.memberCode]);

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
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bank-liquidity"] });
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

  // 4. Update Member Carryover Election Mutation
  const updateCarryoverMutation = useMutation({
    mutationFn: async ({
      memberId,
      payload,
    }: {
      memberId: string;
      payload: UpdateMemberCarryoverRequest;
    }) => {
      const res = await api.put<MemberAllocation>(
        `/distribution/${fiscalYear}/member/${memberId}/carryover`,
        payload
      );
      return res.data;
    },
    onSuccess: (updated) => {
      showToast(
        "success",
        "Carryover Election Saved",
        `${updated.memberName}: ₱${updated.carriedOverAmount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
        })} carried over to FY ${fiscalYear + 1}, ₱${updated.netCashPayout.toLocaleString("en-US", {
          minimumFractionDigits: 2,
        })} net cash payout.`
      );
      setCarryoverMember(null);
      queryClient.invalidateQueries({ queryKey: ["distribution-preview", fiscalYear] });
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        "Failed to save carryover election.";
      showToast("error", "Carryover Update Failed", msg);
    },
  });

  const openCarryoverModal = (member: MemberAllocation) => {
    setCarryoverMember(member);
    setSelectedMode(member.carryoverMode || "None");
    setCarryCapital(Boolean(member.carryoverCapital));
    setCarryDividend(Boolean(member.carryoverDividend));
    setCarryPatronage(Boolean(member.carryoverPatronage));
    setCustomAmountInput(
      member.carryoverMode === "CustomAmount" ? member.carriedOverAmount.toFixed(2) : ""
    );
  };

  const modalGrossEntitlement = carryoverMember
    ? Math.round(
        (carryoverMember.totalContribution +
          carryoverMember.dividendEarned +
          carryoverMember.patronageEarned) *
          100
      ) / 100
    : 0;

  const modalParsedCustom = customAmountInput.trim() === "" ? 0 : Number(customAmountInput);
  const modalCustomInvalid =
    selectedMode === "CustomAmount" &&
    (Number.isNaN(modalParsedCustom) ||
      modalParsedCustom < 0 ||
      modalParsedCustom > modalGrossEntitlement);

  const modalPreviewCarriedOver = useMemo(() => {
    if (!carryoverMember) return 0;
    if (selectedMode === "None") return 0;
    if (selectedMode === "SpecificBuckets") {
      let sum = 0;
      if (carryCapital) sum += carryoverMember.totalContribution;
      if (carryDividend) sum += carryoverMember.dividendEarned;
      if (carryPatronage) sum += carryoverMember.patronageEarned;
      return Math.round(Math.min(sum, modalGrossEntitlement) * 100) / 100;
    }
    if (Number.isNaN(modalParsedCustom)) return 0;
    return Math.round(Math.max(0, Math.min(modalParsedCustom, modalGrossEntitlement)) * 100) / 100;
  }, [
    carryoverMember,
    selectedMode,
    carryCapital,
    carryDividend,
    carryPatronage,
    modalParsedCustom,
    modalGrossEntitlement,
  ]);

  const modalPreviewNetCashPayout =
    Math.round(Math.max(0, modalGrossEntitlement - modalPreviewCarriedOver) * 100) / 100;

  const handleSaveCarryover = () => {
    if (!carryoverMember || modalCustomInvalid) return;
    const payload: UpdateMemberCarryoverRequest = {
      carryoverMode: selectedMode,
      carryoverCapital: selectedMode === "SpecificBuckets" ? carryCapital : false,
      carryoverDividend: selectedMode === "SpecificBuckets" ? carryDividend : false,
      carryoverPatronage: selectedMode === "SpecificBuckets" ? carryPatronage : false,
      customCarryoverAmount:
        selectedMode === "CustomAmount" ? Math.round(modalParsedCustom * 100) / 100 : null,
    };
    updateCarryoverMutation.mutate({ memberId: carryoverMember.memberId, payload });
  };

  const formatCarryoverBadge = (a: MemberAllocation) => {
    if (a.carryoverMode === "SpecificBuckets" && a.carriedOverAmount > 0) {
      const parts: string[] = [];
      if (a.carryoverCapital) parts.push("Cap");
      if (a.carryoverDividend) parts.push("Div");
      if (a.carryoverPatronage) parts.push("Pat");
      return {
        label: parts.length === 3 ? "Rollover 100%" : `Buckets: ${parts.join(" + ")}`,
        className: "bg-indigo-50 text-indigo-700 border-indigo-200",
      };
    }
    if (a.carryoverMode === "CustomAmount" && a.carriedOverAmount > 0) {
      return {
        label: "Custom Amount",
        className: "bg-violet-50 text-violet-700 border-violet-200",
      };
    }
    return {
      label: "Full Payout",
      className: "bg-slate-100 text-slate-600 border-slate-200",
    };
  };

  // Handle Sort Toggle
  const handleSort = (field: keyof MemberAllocation) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Filtered & Sorted Allocations (Admin table)
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

  const paginatedAllocations = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAllocations.slice(start, start + pageSize);
  }, [filteredAllocations, page, pageSize]);

  // Step 3: Export Preview to CSV
  const handleExportCsv = () => {
    if (!preview || !preview.allocations.length) return;

    const headers = [
      "Member ID",
      "Member Name",
      "Email",
      "Ending Capital (PHP)",
      "Contribution Ratio",
      "Dividend Earned (PHP)",
      "Total Borrowing Volume (PHP)",
      "Loan Ratio",
      "Patronage Refund (PHP)",
      "Total Surplus Earned (PHP)",
      "Gross Entitlement (PHP)",
      "Carryover Mode",
      `Carried Over to FY${fiscalYear + 1} (PHP)`,
      "Net Cash Payout (PHP)",
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
      `"${a.carryoverMode || "None"}"`,
      (a.carriedOverAmount ?? 0).toFixed(2),
      (a.netCashPayout ?? a.netSavingsCredited).toFixed(2),
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
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Fiscal Year-End Surplus Distribution & Patronage Refund
            </h2>
            {isMember ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                Member Self-Service
              </span>
            ) : isAdmin ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Admin
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                Loan Officer
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Statutory net surplus partitioning: {preview?.dividendWeightPercent ?? 65}% Dividend,{" "}
            {preview?.patronageWeightPercent ?? 30}% Patronage Refund,{" "}
            {preview?.managementWeightPercent ?? 5}% Management Reserve.
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
              {availableFiscalYears.map((yr) => (
                <option key={yr} value={yr}>
                  FY {yr}
                </option>
              ))}
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

      {isLoadingPreview ? (
        <div className="py-20 text-center bg-white border border-slate-200 rounded-2xl">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">
            Simulating fiscal year-end surplus distribution engine...
          </p>
        </div>
      ) : (
        <>
          {/* REVIEW AGGREGATE POOLS (Admin Only) */}
          {!isMember && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                      <PieChart className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Total Distributable Interest & Pool Breakdown
                      </h3>
                      <p className="text-xs text-slate-500">
                        Sum of upfront loan interest, late penalties, and net bank interest.
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs uppercase font-bold text-slate-400">
                      Total Net Distributable
                    </span>
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
                  {/* Dividend Pool */}
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                        General Dividend ({preview?.dividendWeightPercent ?? 65}%)
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                        Capital Build-Up
                      </span>
                    </div>
                    <div className="text-2xl font-black font-mono text-emerald-950 mt-1">
                      ₱
                      {(preview?.dividendPool || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <p className="text-xs text-emerald-700 mt-2 leading-relaxed">
                      Distributed pro-rata based on member share capital contributions.
                    </p>
                  </div>

                  {/* Patronage Pool */}
                  <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-5 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Receipt className="w-4 h-4 text-blue-600" />
                        Patronage Refund ({preview?.patronageWeightPercent ?? 30}%)
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-200 text-blue-900">
                        Borrowing Volume
                      </span>
                    </div>
                    <div className="text-2xl font-black font-mono text-blue-950 mt-1">
                      ₱
                      {(preview?.patronagePool || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <p className="text-xs text-blue-700 mt-2 leading-relaxed">
                      Refunded pro-rata to borrowing members based on loan volume patronized.
                    </p>
                  </div>

                  {/* Management Pool */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Percent className="w-4 h-4 text-slate-500" />
                        Management / Honoraria ({preview?.managementWeightPercent ?? 5}%)
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                        Reserve & Admin
                      </span>
                    </div>
                    <div className="text-2xl font-black font-mono text-slate-900 mt-1">
                      ₱
                      {(preview?.managementPool || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      Allocated to cooperative committee honoraria and statutory reserves.
                    </p>
                  </div>
                </div>
              </div>

              {/* YEAR-END PAYOUT & CAPITAL CARRYOVER SUMMARY BANNER */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Year-End Payout & Capital Carryover Summary (FY {fiscalYear} → FY {fiscalYear + 1})
                      </h3>
                      <p className="text-xs text-slate-500">
                        Carried-over member funds stay in the primary bank account as Day-1 liquidity for the FIFO Loan Queue.
                      </p>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-slate-500">
                    Primary Bank Cash:{" "}
                    <span className="font-mono font-bold text-slate-900">
                      ₱
                      {(preview?.primaryBankBalance || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Total Gross Entitlement */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Total Gross Entitlement
                      </span>
                      <Wallet className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="text-2xl font-black font-mono text-slate-900">
                      ₱
                      {(preview?.totalGrossEntitlement || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Ending Capital + Dividend ({preview?.dividendWeightPercent ?? 65}%) + Patronage ({preview?.patronageWeightPercent ?? 30}%)
                    </p>
                  </div>

                  {/* Total Carried Over to FY+1 */}
                  <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                        Carried Over to FY {fiscalYear + 1}
                      </span>
                      <RefreshCw className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="text-2xl font-black font-mono text-indigo-950">
                      ₱
                      {(preview?.totalCarriedOverAmount || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <p className="text-[11px] text-indigo-700 mt-1">
                      Retained in Bank for Loan Queue •{" "}
                      {(preview?.allocations || []).filter((a) => (a.carriedOverAmount || 0) > 0).length} member(s) electing carryover
                    </p>
                  </div>

                  {/* Total Cash Required for Payout */}
                  <div
                    className={`p-4 rounded-xl border ${
                      preview?.hasLiquidityShortfall
                        ? "bg-rose-50/80 border-rose-300"
                        : "bg-emerald-50/70 border-emerald-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-xs font-bold uppercase tracking-wider ${
                          preview?.hasLiquidityShortfall ? "text-rose-900" : "text-emerald-900"
                        }`}
                      >
                        Total Cash Required for Payout
                      </span>
                      <Banknote
                        className={`w-4 h-4 ${
                          preview?.hasLiquidityShortfall ? "text-rose-600" : "text-emerald-600"
                        }`}
                      />
                    </div>
                    <div
                      className={`text-2xl font-black font-mono ${
                        preview?.hasLiquidityShortfall ? "text-rose-900" : "text-emerald-950"
                      }`}
                    >
                      ₱
                      {(preview?.totalNetCashPayout || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <p
                      className={`text-[11px] mt-1 ${
                        preview?.hasLiquidityShortfall ? "text-rose-700 font-semibold" : "text-emerald-700"
                      }`}
                    >
                      {preview?.hasLiquidityShortfall
                        ? `Exceeds Primary Bank Cash by ₱${(
                            preview?.liquidityShortfallAmount || 0
                          ).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                        : `Covered by Primary Bank Cash (₱${Math.max(
                            0,
                            (preview?.primaryBankBalance || 0) - (preview?.totalNetCashPayout || 0)
                          ).toLocaleString("en-US", { minimumFractionDigits: 2 })} remaining)`}
                    </p>
                  </div>
                </div>

                {/* Liquidity Validation Warning */}
                {preview?.hasLiquidityShortfall && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs leading-relaxed">
                      <div className="font-bold text-amber-950">
                        Liquidity Warning: Net Cash Payouts Exceed Available Primary Bank Cash
                      </div>
                      <p className="mt-0.5">
                        Total cash required for payout (
                        <span className="font-mono font-bold">
                          ₱
                          {(preview.totalNetCashPayout || 0).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                        ) exceeds the primary bank account balance (
                        <span className="font-mono font-bold">
                          ₱
                          {(preview.primaryBankBalance || 0).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                        ) by{" "}
                        <span className="font-mono font-bold text-rose-700">
                          ₱
                          {(preview.liquidityShortfallAmount || 0).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                        . Flag additional members for Capital/Surplus Carryover below or reconcile bank cash before finalizing.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: MEMBER PORTAL PERSONAL ALLOCATION VIEW vs ADMIN ALL-MEMBER PREVIEW TABLE */}
          {isMember ? (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold border border-sky-100">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        My Surplus & Patronage Allocation (FY {fiscalYear})
                      </h3>
                      {myAllocation?.memberCode && (
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
                          {myAllocation.memberCode}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Personal dividend and patronage refund computation for{" "}
                      <span className="font-semibold text-slate-700">
                        {myAllocation?.memberName || user?.memberName || user?.username}
                      </span>
                    </p>
                  </div>
                </div>

                {myAllocation && (
                  <button
                    onClick={() => setSelectedSoaMemberId(myAllocation.memberId)}
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    View / Print My Official SOA
                  </button>
                )}
              </div>

              {!myAllocation ? (
                <div className="p-12 text-center text-sm text-slate-500">
                  No surplus allocation record found for your member profile in FY {fiscalYear}.
                </div>
              ) : (
                <div className="p-6 space-y-6">
                  {/* 4 Personal Allocation KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          My Share Capital
                        </span>
                        <Wallet className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="text-xl font-black font-mono text-slate-900">
                        ₱
                        {myAllocation.totalContribution.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {(myAllocation.contributionRatio * 100).toFixed(2)}% of cooperative capital pool
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                          My Dividend ({preview?.dividendWeightPercent ?? 65}%)
                        </span>
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="text-xl font-black font-mono text-emerald-800">
                        ₱
                        {myAllocation.dividendEarned.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                      <div className="text-[11px] text-emerald-700 mt-1">
                        Earned from share capital build-up
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
                          My Patronage ({preview?.patronageWeightPercent ?? 30}%)
                        </span>
                        <HandCoins className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="text-xl font-black font-mono text-blue-800">
                        ₱
                        {myAllocation.patronageEarned.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                      <div className="text-[11px] text-blue-700 mt-1">
                        Loan Volume: ₱
                        {myAllocation.totalLoansBorrowed.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}{" "}
                        ({(myAllocation.loanRatio * 100).toFixed(2)}%)
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900 text-white">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Net Savings Credited
                        </span>
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="text-xl font-black font-mono text-emerald-400">
                        ₱
                        {myAllocation.netSavingsCredited.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                      <div className="text-[11px] text-slate-300 mt-1">
                        Total Surplus Earned: ₱
                        {myAllocation.totalSurplusEarned.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Detailed Personal Computation Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Personal Surplus Entitlement Breakdown
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        {preview?.isAlreadyFinalized ? "Final Audited Credit" : "Provisional Calculation"}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100 text-sm">
                      <div className="px-4 py-3 flex items-center justify-between hover:bg-slate-50/60">
                        <div>
                          <div className="font-semibold text-slate-800">
                            Accumulated Share Capital Contribution
                          </div>
                          <div className="text-xs text-slate-400">
                            Pro-rata share: {(myAllocation.contributionRatio * 100).toFixed(4)}% of ₱
                            {(preview?.grandTotalContributions || 0).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}{" "}
                            total cooperative capital
                          </div>
                        </div>
                        <div className="font-mono font-bold text-slate-900">
                          ₱
                          {myAllocation.totalContribution.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                      </div>

                      <div className="px-4 py-3 flex items-center justify-between hover:bg-slate-50/60">
                        <div>
                          <div className="font-semibold text-emerald-800">
                            (+) General Dividend Allocation ({preview?.dividendWeightPercent ?? 65}%)
                          </div>
                          <div className="text-xs text-slate-400">
                            {(myAllocation.contributionRatio * 100).toFixed(4)}% × ₱
                            {(preview?.dividendPool || 0).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}{" "}
                            dividend pool
                          </div>
                        </div>
                        <div className="font-mono font-bold text-emerald-700">
                          ₱
                          {myAllocation.dividendEarned.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                      </div>

                      <div className="px-4 py-3 flex items-center justify-between hover:bg-slate-50/60">
                        <div>
                          <div className="font-semibold text-blue-800">
                            (+) Patronage Refund Allocation ({preview?.patronageWeightPercent ?? 30}%)
                          </div>
                          <div className="text-xs text-slate-400">
                            {(myAllocation.loanRatio * 100).toFixed(4)}% loan volume share (₱
                            {myAllocation.totalLoansBorrowed.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}
                            ) × ₱
                            {(preview?.patronagePool || 0).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                            })}{" "}
                            patronage pool
                          </div>
                        </div>
                        <div className="font-mono font-bold text-blue-700">
                          ₱
                          {myAllocation.patronageEarned.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                      </div>

                      <div className="px-4 py-3 flex items-center justify-between bg-emerald-50/50 font-bold">
                        <div className="text-slate-900">
                          (=) Total Year-End Surplus Earned (Dividend + Patronage)
                        </div>
                        <div className="font-mono text-emerald-800">
                          ₱
                          {myAllocation.totalSurplusEarned.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                      </div>

                      <div className="px-4 py-3.5 flex items-center justify-between bg-slate-900 text-white font-extrabold">
                        <div>Total Gross Entitlement (Share Capital + Surplus Earned)</div>
                        <div className="font-mono text-base text-emerald-400">
                          ₱
                          {myAllocation.netSavingsCredited.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                      </div>

                      {(myAllocation.carriedOverAmount || 0) > 0 && (
                        <>
                          <div className="px-4 py-3 flex items-center justify-between bg-indigo-50/70">
                            <div className="font-semibold text-indigo-900">
                              (-) Carried Over to FY {fiscalYear + 1} Opening Capital
                            </div>
                            <div className="font-mono font-bold text-indigo-700">
                              ₱
                              {myAllocation.carriedOverAmount.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                              })}
                            </div>
                          </div>
                          <div className="px-4 py-3 flex items-center justify-between bg-emerald-50/70 font-bold">
                            <div className="text-emerald-950">(=) Net Cash Payout</div>
                            <div className="font-mono text-emerald-800">
                              ₱
                              {myAllocation.netCashPayout.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    Member Allocation Preview & Pro-Rata Credits
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

                  {isAdmin && !preview?.isAlreadyFinalized && (
                    <button
                      onClick={() => setIsFinalizeModalOpen(true)}
                      className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer"
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
                          Ending Capital
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("dividendEarned")}
                        className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                      >
                        <div className="flex items-center justify-end gap-1">
                          Dividend ({preview?.dividendWeightPercent ?? 65}%)
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("patronageEarned")}
                        className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                      >
                        <div className="flex items-center justify-end gap-1">
                          Patronage ({preview?.patronageWeightPercent ?? 30}%)
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("netSavingsCredited")}
                        className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                      >
                        <div className="flex items-center justify-end gap-1 font-bold text-slate-800">
                          Gross Entitlement
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="py-3 px-4 text-center">Carryover Election</th>
                      <th
                        onClick={() => handleSort("carriedOverAmount")}
                        className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                      >
                        <div className="flex items-center justify-end gap-1 font-bold text-indigo-800">
                          Carried Over
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort("netCashPayout")}
                        className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
                      >
                        <div className="flex items-center justify-end gap-1 font-bold text-emerald-800">
                          Net Cash Payout
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedAllocations.map((a) => {
                      const badge = formatCarryoverBadge(a);
                      return (
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
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-blue-700">
                            ₱{a.patronageEarned.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            <div className="text-[10px] font-normal text-slate-400">
                              Vol: ₱{a.totalLoansBorrowed.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                            ₱{a.netSavingsCredited.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {!preview?.isAlreadyFinalized ? (
                              <button
                                onClick={() => openCarryoverModal(a)}
                                className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all hover:shadow-xs cursor-pointer ${badge.className}`}
                                title="Configure Carryover Election"
                              >
                                <SlidersHorizontal className="w-3 h-3" />
                                {badge.label}
                              </button>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-700 text-sm">
                            ₱{(a.carriedOverAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-800 text-sm">
                            ₱{(a.netCashPayout ?? a.netSavingsCredited).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => setSelectedSoaMemberId(a.memberId)}
                              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                            >
                              <FileText className="w-3 h-3 text-slate-500" />
                              View SOA
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <TablePagination
                page={page}
                pageSize={pageSize}
                totalItems={filteredAllocations.length}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                itemLabel={`member allocations for FY ${fiscalYear}`}
                extraContent={
                  <span>
                    Total Surplus Credited:{" "}
                    <span className="font-mono font-bold text-emerald-700">
                      ₱
                      {(
                        (preview?.dividendPool || 0) + (preview?.patronagePool || 0)
                      ).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </span>
                }
              />
            </div>
          )}
        </>
      )}

      {/* 3. STEP 4: TWO-STEP FINALIZE CONFIRMATION MODAL */}
      {isFinalizeModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <BadgeAlert className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Confirm Year-End Finalization
                  </h3>
                  <p className="text-xs text-slate-500">Fiscal Year {fiscalYear} Closeout & FY {fiscalYear + 1} Carryover</p>
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

              {preview?.hasLiquidityShortfall && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Cash payout (₱{(preview.totalNetCashPayout || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}) exceeds Primary Bank balance (₱{(preview.primaryBankBalance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}) by ₱{(preview.liquidityShortfallAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                  <div className="text-[10px] font-bold uppercase text-indigo-700">Carried Over to FY {fiscalYear + 1}</div>
                  <div className="text-base font-black font-mono text-indigo-950 mt-0.5">
                    ₱{(preview?.totalCarriedOverAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-[10px] font-bold uppercase text-emerald-700">Deducted from Primary Bank</div>
                  <div className="text-base font-black font-mono text-emerald-950 mt-0.5">
                    ₱{(preview?.totalNetCashPayout || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <p>By confirming this closeout:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-700 font-medium">
                <li>All 24 semi-monthly payroll cutoffs for FY {fiscalYear} will be marked CLOSED.</li>
                <li>
                  An Opening Balance cutoff and 24 semi-monthly cutoffs (Jan-15 to Dec-31) will be automatically generated for FY{" "}
                  {fiscalYear + 1}.
                </li>
                <li>
                  Elected member carryovers (₱{(preview?.totalCarriedOverAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}) will be reinvested as FY {fiscalYear + 1} opening contribution capital.
                </li>
                <li>
                  Only the net cash payout (₱{(preview?.totalNetCashPayout || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}) will be deducted from the primary bank account, preserving carried-over funds for Day-1 FIFO Loan Queue liquidity.
                </li>
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
                    I verify that the audit reconciliations and board resolutions have approved the
                    FY {fiscalYear} distributions.
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

      {/* 3b. MEMBER CARRYOVER ELECTION MODAL */}
      {carryoverMember && !isMember && !preview?.isAlreadyFinalized && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-4">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-indigo-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Carryover Election — {carryoverMember.memberName}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {carryoverMember.memberCode} • Roll over into FY {fiscalYear + 1} Opening Capital
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCarryoverMember(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Entitlement Breakdown Mini-Cards */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Ending Capital</div>
                  <div className="text-xs font-mono font-bold text-slate-900 mt-0.5">
                    ₱{carryoverMember.totalContribution.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <div className="text-[10px] font-bold uppercase text-emerald-700">Dividend</div>
                  <div className="text-xs font-mono font-bold text-emerald-900 mt-0.5">
                    ₱{carryoverMember.dividendEarned.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200">
                  <div className="text-[10px] font-bold uppercase text-blue-700">Patronage</div>
                  <div className="text-xs font-mono font-bold text-blue-900 mt-0.5">
                    ₱{carryoverMember.patronageEarned.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs">
                <span className="font-semibold text-slate-300">Gross Entitlement</span>
                <span className="font-mono font-black text-sm text-emerald-400">
                  ₱{modalGrossEntitlement.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Mode Selector */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Select Carryover Mode
                </label>

                {/* Option 1: Full Cash Payout */}
                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    selectedMode === "None"
                      ? "bg-slate-50 border-slate-400 ring-1 ring-slate-400/30"
                      : "bg-white border-slate-200 hover:bg-slate-50/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="carryoverMode"
                    checked={selectedMode === "None"}
                    onChange={() => setSelectedMode("None")}
                    className="mt-0.5 text-slate-700 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Full Cash Payout (No Carryover)</div>
                    <div className="text-[11px] text-slate-500">
                      Disburse 100% of entitlement in cash; ₱0.00 rolled over to FY {fiscalYear + 1}.
                    </div>
                  </div>
                </label>

                {/* Option 2: Specific Buckets */}
                <div
                  className={`p-3 rounded-xl border transition-colors ${
                    selectedMode === "SpecificBuckets"
                      ? "bg-indigo-50/50 border-indigo-400 ring-1 ring-indigo-400/30"
                      : "bg-white border-slate-200 hover:bg-slate-50/60"
                  }`}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="carryoverMode"
                      checked={selectedMode === "SpecificBuckets"}
                      onChange={() => setSelectedMode("SpecificBuckets")}
                      className="mt-0.5 text-indigo-600 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-slate-900">Specific Buckets</div>
                      <div className="text-[11px] text-slate-500">
                        Choose which entitlement buckets to reinvest into FY {fiscalYear + 1} opening capital.
                      </div>
                    </div>
                  </label>

                  {selectedMode === "SpecificBuckets" && (
                    <div className="mt-3 pl-6 space-y-2 border-t border-indigo-100 pt-3">
                      <label className="flex items-center justify-between text-xs cursor-pointer">
                        <span className="flex items-center gap-2 font-medium text-slate-800">
                          <input
                            type="checkbox"
                            checked={carryCapital}
                            onChange={(e) => setCarryCapital(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 w-4 h-4 cursor-pointer"
                          />
                          Ending Contribution Capital
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          ₱{carryoverMember.totalContribution.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </label>

                      <label className="flex items-center justify-between text-xs cursor-pointer">
                        <span className="flex items-center gap-2 font-medium text-slate-800">
                          <input
                            type="checkbox"
                            checked={carryDividend}
                            onChange={(e) => setCarryDividend(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 w-4 h-4 cursor-pointer"
                          />
                          Dividend Earned ({preview?.dividendWeightPercent ?? 65}%)
                        </span>
                        <span className="font-mono font-bold text-emerald-700">
                          ₱{carryoverMember.dividendEarned.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </label>

                      <label className="flex items-center justify-between text-xs cursor-pointer">
                        <span className="flex items-center gap-2 font-medium text-slate-800">
                          <input
                            type="checkbox"
                            checked={carryPatronage}
                            onChange={(e) => setCarryPatronage(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 w-4 h-4 cursor-pointer"
                          />
                          Patronage Refund ({preview?.patronageWeightPercent ?? 30}%)
                        </span>
                        <span className="font-mono font-bold text-blue-700">
                          ₱{carryoverMember.patronageEarned.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                      </label>

                      <div className="pt-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setCarryCapital(true);
                            setCarryDividend(true);
                            setCarryPatronage(true);
                          }}
                          className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
                        >
                          Select All (100% Rollover)
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Option 3: Custom Amount */}
                <div
                  className={`p-3 rounded-xl border transition-colors ${
                    selectedMode === "CustomAmount"
                      ? "bg-violet-50/50 border-violet-400 ring-1 ring-violet-400/30"
                      : "bg-white border-slate-200 hover:bg-slate-50/60"
                  }`}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="carryoverMode"
                      checked={selectedMode === "CustomAmount"}
                      onChange={() => setSelectedMode("CustomAmount")}
                      className="mt-0.5 text-violet-600 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-slate-900">Custom Carryover Amount</div>
                      <div className="text-[11px] text-slate-500">
                        Specify any exact peso amount up to ₱{modalGrossEntitlement.toLocaleString("en-US", { minimumFractionDigits: 2 })}.
                      </div>
                    </div>
                  </label>

                  {selectedMode === "CustomAmount" && (
                    <div className="mt-3 pl-6 space-y-2 border-t border-violet-100 pt-3">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          ₱
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={modalGrossEntitlement}
                          step="0.01"
                          value={customAmountInput}
                          onChange={(e) => setCustomAmountInput(e.target.value)}
                          placeholder="0.00"
                          className={`w-full pl-7 pr-3 py-2 text-sm font-mono font-bold bg-white border rounded-xl focus:outline-none focus:ring-2 ${
                            modalCustomInvalid
                              ? "border-rose-400 focus:ring-rose-500/20 text-rose-700"
                              : "border-slate-300 focus:ring-violet-500/20 focus:border-violet-500 text-slate-900"
                          }`}
                        />
                      </div>
                      {modalCustomInvalid && (
                        <p className="text-[11px] font-semibold text-rose-600">
                          Amount must be between ₱0.00 and ₱{modalGrossEntitlement.toLocaleString("en-US", { minimumFractionDigits: 2 })}.
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {[0.25, 0.5, 0.75, 1].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() =>
                              setCustomAmountInput((modalGrossEntitlement * pct).toFixed(2))
                            }
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-violet-100 hover:bg-violet-200 text-violet-800 transition-colors cursor-pointer"
                          >
                            {pct * 100}%
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Live Split Result */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                  <div className="text-[10px] font-bold uppercase text-indigo-700">
                    Carried Over to FY {fiscalYear + 1}
                  </div>
                  <div className="text-lg font-black font-mono text-indigo-950 mt-0.5">
                    ₱{modalPreviewCarriedOver.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="text-[10px] font-bold uppercase text-emerald-700">
                    Net Cash Payout
                  </div>
                  <div className="text-lg font-black font-mono text-emerald-950 mt-0.5">
                    ₱{modalPreviewNetCashPayout.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCarryoverMember(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={modalCustomInvalid || updateCarryoverMutation.isPending}
                  onClick={handleSaveCarryover}
                  className={`px-5 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer ${
                    !modalCustomInvalid && !updateCarryoverMutation.isPending
                      ? "bg-indigo-600 hover:bg-indigo-700"
                      : "bg-slate-300 cursor-not-allowed"
                  }`}
                >
                  {updateCarryoverMutation.isPending ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Carryover Election"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. INDIVIDUAL STATEMENT OF ACCOUNT (SOA) PRINTABLE MODAL */}
      {selectedSoaMemberId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-4 sm:my-8">
            {/* Top Modal Controls (Hidden in Print) */}
            <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between print:hidden">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 truncate mr-2">
                Official Statement of Account & Patronage Voucher
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handlePrintSoa}
                  className="flex items-center gap-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />{" "}
                  <span className="hidden sm:inline">Print / Save as PDF</span>
                  <span className="sm:hidden">Print</span>
                </button>
                <button
                  onClick={() => setSelectedSoaMemberId(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Statement Document */}
            {isLoadingSoa ? (
              <div className="py-24 text-center">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-500 font-medium">
                  Generating official member statement...
                </p>
              </div>
            ) : soaData ? (
              <div id="soa-printable-voucher" className="p-4 sm:p-8 text-slate-900 space-y-6">
                {/* Header */}
                <div className="text-center border-b pb-4 border-slate-200">
                  <div className="font-extrabold text-lg sm:text-xl tracking-tight uppercase text-emerald-800">
                    Cooperative Information System (CoopIS)
                  </div>
                  <div className="text-xs text-slate-500">
                    Republic of the Philippines • Cooperative Financial Board
                  </div>
                  <div className="text-xs sm:text-sm font-bold mt-2 uppercase tracking-wider text-slate-800">
                    Annual Statement of Account & Patronage Certificate
                  </div>
                  <div className="text-xs text-slate-400">Fiscal Year {soaData.fiscalYear}</div>
                </div>

                {/* Member Profile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-400 uppercase font-semibold">Member Name:</span>
                    <div className="font-bold text-sm text-slate-900">{soaData.memberName}</div>
                    <div className="font-mono text-slate-500">{soaData.memberCode}</div>
                  </div>
                  <div className="sm:text-right">
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
                  <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-center text-xs">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <div className="text-slate-500 font-medium">Contribution Capital</div>
                      <div className="font-mono font-bold text-sm text-slate-900 mt-1">
                        ₱
                        {soaData.totalContributions.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Ratio: {(soaData.contributionRatio * 100).toFixed(4)}%
                      </div>
                    </div>

                    <div className="p-3 bg-emerald-50 rounded-lg">
                      <div className="text-emerald-800 font-medium">Dividend (65%)</div>
                      <div className="font-mono font-bold text-sm text-emerald-900 mt-1">
                        ₱
                        {soaData.dividendEarned.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                      <div className="text-[10px] text-emerald-600">Capital Build-up</div>
                    </div>

                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="text-blue-800 font-medium">Patronage Refund (30%)</div>
                      <div className="font-mono font-bold text-sm text-blue-900 mt-1">
                        ₱
                        {soaData.patronageEarned.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                      <div className="text-[10px] text-blue-600">Borrowing Volume</div>
                    </div>
                  </div>
                </div>

                {/* Total Payout Summary */}
                <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                      Total Gross Entitlement
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Capital (₱{soaData.totalContributions.toLocaleString()}) + Surplus (₱
                      {soaData.totalSurplusEarned.toLocaleString()})
                    </div>
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                    ₱
                    {soaData.netSavingsCredited.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                </div>

                {(soaData.carriedOverAmount || 0) > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-900">
                        Carried Over to FY {soaData.fiscalYear + 1}
                      </span>
                      <span className="font-mono font-black text-sm text-indigo-800">
                        ₱
                        {(soaData.carriedOverAmount || 0).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900">Net Cash Payout</span>
                      <span className="font-mono font-black text-sm text-emerald-800">
                        ₱
                        {(soaData.netCashPayout ?? soaData.netSavingsCredited).toLocaleString(
                          "en-US",
                          { minimumFractionDigits: 2 }
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {/* Authorized Signatures */}
                <div className="pt-6 sm:pt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 text-center text-xs border-t border-slate-200">
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
