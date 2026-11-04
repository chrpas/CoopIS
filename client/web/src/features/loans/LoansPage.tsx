import React, { useState, useMemo } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import {
  Loan,
  Member,
  LoanStatus,
  AmortizationScheduleItem,
  FinancialPolicyResponse,
} from "../../types";
import { useAuth } from "../../context/AuthContext";
import { TablePagination, DEFAULT_PAGE_SIZE } from "../../components/ui/TablePagination";
import { LoanOriginationWizard } from "./LoanOriginationWizard";
import { AmortizationScheduleModal } from "./AmortizationScheduleModal";
import { RecordRepaymentModal } from "./RecordRepaymentModal";
import { LoanPenaltiesModal } from "./LoanPenaltiesModal";
import {
  Plus,
  CheckCircle,
  Clock,
  FileText,
  Ban,
  ChevronRight,
  ChevronDown,
  History,
  Search,
  Users,
  HandCoins,
  X,
} from "lucide-react";

interface MemberLoanGroup {
  memberId: string;
  memberName: string;
  memberCode: string;
  email: string;
  loans: Loan[];
  activeLoansCount: number;
  paidLoansCount: number;
  totalLoansCount: number;
  activePrincipal: number;
  lifetimePrincipal: number;
  activePrincipalPaid: number;
  totalActiveBalance: number;
  activeCutoffAmortization: number;
  totalLatePenalties: number;
}

export const LoansPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showWizard, setShowWizard] = useState(false);
  const [selectedLoanForSchedule, setSelectedLoanForSchedule] = useState<Loan | null>(null);
  const [selectedCutoffForRepayment, setSelectedCutoffForRepayment] =
    useState<AmortizationScheduleItem | null>(null);
  const [isRepaymentModalOpen, setIsRepaymentModalOpen] = useState(false);
  const [isPenaltiesModalOpen, setIsPenaltiesModalOpen] = useState(false);

  // Filter, Expand & Pagination States
  const [searchTerm, setSearchTerm] = useState("");
  const [borrowerFilter, setBorrowerFilter] = useState<"active" | "all">("active");
  const [expandedMemberIds, setExpandedMemberIds] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  const { data: loans = [], isLoading } = useQuery<Loan[]>({
    queryKey: ["loans"],
    queryFn: async () => {
      const res = await api.get<Loan[]>("/loans");
      return res.data;
    },
  });

  const { data: financialPolicy } = useQuery<FinancialPolicyResponse>({
    queryKey: ["financial-policy"],
    queryFn: async () => {
      const res = await api.get<FinancialPolicyResponse>("/settings/financial-policy");
      return res.data;
    },
  });

  const activeInterestPercent =
    financialPolicy?.activeLoanPolicy.standardLoanInterestRatePercent ?? 5.0;
  const activePenaltyPercent =
    financialPolicy?.activeLoanPolicy.latePenaltyRatePercent ?? 2.0;

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["members-lookup"],
    queryFn: async () => {
      try {
        const res = await api.get<any>("/members?pageSize=200");
        return Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
      } catch {
        return [];
      }
    },
  });

  const memberMap = useMemo(() => {
    const map = new Map<string, Member>();
    members.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  // Query amortization schedule for selected loan when needed for penalties modal fallback
  const { data: schedule = [] } = useQuery<AmortizationScheduleItem[]>({
    queryKey: ["loan-schedule", selectedLoanForSchedule?.id],
    queryFn: async () => {
      if (!selectedLoanForSchedule) return [];
      const res = await api.get<AmortizationScheduleItem[]>(
        `/loans/${selectedLoanForSchedule.id}/schedule`
      );
      return res.data;
    },
    enabled: !!selectedLoanForSchedule,
  });

  // Fetch schedule entries for all loans so penalties across all schedule entries can be computed per loan and per member group
  const allLoanScheduleQueries = useQueries({
    queries: loans.map((loan) => ({
      queryKey: ["loan-schedule", loan.id],
      queryFn: async () => {
        const res = await api.get<AmortizationScheduleItem[]>(`/loans/${loan.id}/schedule`);
        return res.data;
      },
      staleTime: 30_000,
    })),
  });

  // Compute total penalties and schedule-verified status for each loan by inspecting all of its schedule entries
  const { loanSchedulePenaltiesMap, loanScheduleStatusMap } = useMemo(() => {
    const penaltiesMap = new Map<string, number>();
    const statusMap = new Map<string, LoanStatus>();

    const isEntryPaid = (entry: AmortizationScheduleItem) =>
      (entry.status || "").toUpperCase() === "PAID" ||
      Math.round((Number(entry.principalPaid) || 0) * 100) >=
        Math.round((Number(entry.scheduledPrincipal) || 0) * 100);

    loans.forEach((loan, idx) => {
      const scheduleEntries = allLoanScheduleQueries[idx]?.data;
      if (scheduleEntries && scheduleEntries.length > 0) {
        const computedPenalties = scheduleEntries.reduce((sum, entry) => {
          const paid = isEntryPaid(entry);
          const paidPenalty = Number(entry.latePenaltyPaid) || 0;
          const accruedPenalty = paid ? 0 : Number(entry.accruedPenalty) || 0;
          const entryPenalty = paidPenalty > 0 ? paidPenalty + accruedPenalty : accruedPenalty;
          return sum + entryPenalty;
        }, 0);
        penaltiesMap.set(loan.id, Math.round(computedPenalties * 100) / 100);

        const allEntriesPaid = scheduleEntries.every((entry) => isEntryPaid(entry));
        if (allEntriesPaid) {
          statusMap.set(loan.id, "PAID");
        } else if (loan.status === "PAID") {
          statusMap.set(loan.id, "ACTIVE");
        } else {
          statusMap.set(loan.id, loan.status);
        }
      } else {
        penaltiesMap.set(loan.id, Number(loan.totalLatePenalties) || 0);
        statusMap.set(loan.id, loan.status);
      }
    });

    return { loanSchedulePenaltiesMap: penaltiesMap, loanScheduleStatusMap: statusMap };
  }, [loans, allLoanScheduleQueries]);

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
        queryClient.invalidateQueries({
          queryKey: ["loan-schedule", selectedLoanForSchedule.id],
        });
      }
    },
  });

  // Group loans into distinct member rows
  const memberGroups = useMemo<MemberLoanGroup[]>(() => {
    const groupsMap = new Map<string, Loan[]>();
    loans.forEach((loan) => {
      const effectiveStatus = loanScheduleStatusMap.get(loan.id) ?? loan.status;
      const normalizedLoan: Loan = {
        ...loan,
        status: effectiveStatus,
      };
      const list = groupsMap.get(loan.memberId) || [];
      list.push(normalizedLoan);
      groupsMap.set(loan.memberId, list);
    });

    const groups: MemberLoanGroup[] = [];
    groupsMap.forEach((memberLoans, memberId) => {
      const memberInfo = memberMap.get(memberId);
      // Sort member's loans: ACTIVE first, then PENDING/APPROVED, then PAID, then newest first
      const sortedLoans = [...memberLoans].sort((a, b) => {
        const rank = (s: LoanStatus) =>
          s === "ACTIVE" ? 0 : s === "APPROVED" || s === "PENDING_APPROVAL" ? 1 : 2;
        if (rank(a.status) !== rank(b.status)) {
          return rank(a.status) - rank(b.status);
        }
        return (
          new Date(b.originationDate).getTime() - new Date(a.originationDate).getTime()
        );
      });

      const activeLoans = sortedLoans.filter((l) => l.status === "ACTIVE");
      const paidLoans = sortedLoans.filter((l) => l.status === "PAID");

      const activePrincipal = activeLoans.reduce(
        (sum, l) => sum + (Number(l.principalAmount) || 0),
        0
      );
      const lifetimePrincipal = sortedLoans.reduce(
        (sum, l) => sum + (Number(l.principalAmount) || 0),
        0
      );
      const activePrincipalPaid = activeLoans.reduce(
        (sum, l) => sum + (Number(l.totalRepayments) || 0),
        0
      );
      const totalActiveBalance = activeLoans.reduce((sum, l) => {
        const rem = Math.max(
          0,
          (Number(l.principalAmount) || 0) - (Number(l.totalRepayments) || 0)
        );
        return sum + rem;
      }, 0);
      const activeCutoffAmortization = activeLoans.reduce(
        (sum, l) => sum + (Number(l.cutoffPaymentAmount) || 0),
        0
      );
      const totalLatePenalties = sortedLoans.reduce(
        (sum, l) =>
          sum + (loanSchedulePenaltiesMap.get(l.id) ?? (Number(l.totalLatePenalties) || 0)),
        0
      );

      groups.push({
        memberId,
        memberName: sortedLoans[0]?.memberName || "Unknown Member",
        memberCode: memberInfo?.memberCode || "MEM",
        email: memberInfo?.email || "",
        loans: sortedLoans,
        activeLoansCount: activeLoans.length,
        paidLoansCount: paidLoans.length,
        totalLoansCount: sortedLoans.length,
        activePrincipal,
        lifetimePrincipal,
        activePrincipalPaid,
        totalActiveBalance,
        activeCutoffAmortization,
        totalLatePenalties,
      });
    });

    // Sort borrowers by Total Active Balance descending, then name
    return groups.sort((a, b) => {
      if (b.totalActiveBalance !== a.totalActiveBalance) {
        return b.totalActiveBalance - a.totalActiveBalance;
      }
      return a.memberName.localeCompare(b.memberName);
    });
  }, [loans, memberMap, loanSchedulePenaltiesMap, loanScheduleStatusMap]);

  // Filter distinct member groups (default: only members with active loans)
  const filteredGroups = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return memberGroups.filter((g) => {
      if (borrowerFilter === "active" && g.activeLoansCount === 0) {
        return false;
      }
      if (!term) return true;
      const matchesMember =
        g.memberName.toLowerCase().includes(term) ||
        g.memberCode.toLowerCase().includes(term) ||
        g.email.toLowerCase().includes(term);
      const matchesLoanRef = g.loans.some((l) =>
        l.loanReference.toLowerCase().includes(term)
      );
      return matchesMember && true || matchesLoanRef;
    });
  }, [memberGroups, borrowerFilter, searchTerm]);

  const paginatedGroups = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredGroups.slice(start, start + pageSize);
  }, [filteredGroups, page, pageSize]);

  const activeBorrowersCount = useMemo(
    () => memberGroups.filter((g) => g.activeLoansCount > 0).length,
    [memberGroups]
  );

  const totalActivePortfolioBalance = useMemo(
    () => memberGroups.reduce((sum, g) => sum + g.totalActiveBalance, 0),
    [memberGroups]
  );

  const totalLatePenaltiesCollected = useMemo(
    () => memberGroups.reduce((sum, g) => sum + g.totalLatePenalties, 0),
    [memberGroups]
  );

  const toggleExpandMember = (memberId: string) => {
    setExpandedMemberIds((prev) => ({
      ...prev,
      [memberId]: !prev[memberId],
    }));
  };

  const expandAllVisible = () => {
    const next: Record<string, boolean> = { ...expandedMemberIds };
    paginatedGroups.forEach((g) => {
      next[g.memberId] = true;
    });
    setExpandedMemberIds(next);
  };

  const collapseAll = () => {
    setExpandedMemberIds({});
  };

  const getStatusBadge = (status: LoanStatus) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3 h-3 text-emerald-600" /> ACTIVE
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <CheckCircle className="w-3 h-3 text-blue-600" /> APPROVED
          </span>
        );
      case "PENDING_APPROVAL":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" /> PENDING
          </span>
        );
      case "PAID":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            PAID
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <Ban className="w-3 h-3 text-rose-600" /> {status}
          </span>
        );
    }
  };

  const formatCurrency = (val: number) =>
    `₱${Number(val || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Loan Management & Member Portfolios
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Cooperative Lending Service
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Distinct active borrowers directory. Expand any member row to inspect their complete loan portfolio and payment history.
          </p>
        </div>

        <button
          onClick={() => setShowWizard(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-all hover:shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Originate Loan (Wizard)
        </button>
      </div>

      {/* Loan Policy & Portfolio Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase">
            Active Borrowers
          </div>
          <div className="text-base font-extrabold text-slate-900 mt-0.5">
            {activeBorrowersCount} Members
          </div>
          <div className="text-[11px] text-slate-500">
            Holding active loan accounts
          </div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase">
            Total Active Balance
          </div>
          <div className="text-base font-extrabold text-emerald-700 mt-0.5 font-mono">
            {formatCurrency(totalActivePortfolioBalance)}
          </div>
          <div className="text-[11px] text-slate-500">
            Outstanding principal receivable
          </div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase">
            Upfront Interest Policy
          </div>
          <div className="text-base font-bold text-amber-700 mt-0.5">
            {activeInterestPercent.toFixed(2)}% Flat
          </div>
          <div className="text-[11px] text-slate-500">Deducted at Release</div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="text-[11px] font-semibold text-slate-400 uppercase">
            Total Portfolio Records
          </div>
          <div className="text-base font-bold text-slate-900 mt-0.5">
            {loans.length} Loans
          </div>
          <div className="text-[11px] text-slate-500">
            Across {memberGroups.length} members
          </div>
        </div>

        <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl shadow-xs">
          <div className="text-[11px] font-semibold text-amber-800 uppercase flex items-center justify-between">
            <span>Late Penalties</span>
            <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-bold">
              {activePenaltyPercent}% Rate
            </span>
          </div>
          <div className="text-base font-extrabold text-amber-950 mt-0.5 font-mono">
            {formatCurrency(totalLatePenaltiesCollected)}
          </div>
          <div className="text-[11px] text-amber-700">Cumulative Co-op Income</div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Search borrower name, member code, or loan reference (LN-...)..."
            className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Active Borrowers vs All Borrowers Toggle */}
          <div className="bg-slate-100 p-1 rounded-xl inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setBorrowerFilter("active");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                borrowerFilter === "active"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Members w/ Active Loans ({activeBorrowersCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setBorrowerFilter("all");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                borrowerFilter === "all"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Borrowers ({memberGroups.length})
            </button>
          </div>

          <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

          <button
            type="button"
            onClick={expandAllVisible}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Master-Detail Member Loan Portfolio Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-sm text-slate-500 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading member loan portfolios...</span>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900">
              No Borrower Records Found
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {borrowerFilter === "active"
                ? "No members currently match with active loans. Switch to 'All Borrowers' or clear your search filter."
                : "No loan portfolios found. Click 'Originate Loan (Wizard)' to create a loan."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Borrower</th>
                  <th className="py-3.5 px-4 text-center">Loan Standing</th>
                  <th className="py-3.5 px-4 text-right">Active Principal</th>
                  <th className="py-3.5 px-4 text-right">Repayment Progress</th>
                  <th className="py-3.5 px-4 text-right">Total Active Balance</th>
                  <th className="py-3.5 px-4 text-right">Semi-Monthly Due</th>
                  <th className="py-3.5 px-4 text-right">Late Penalties</th>
                  <th className="py-3.5 px-4 text-right">Portfolio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {paginatedGroups.map((group) => {
                  const isExpanded = Boolean(expandedMemberIds[group.memberId]);
                  const progressPct =
                    group.activePrincipal > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (group.activePrincipalPaid / group.activePrincipal) * 100
                          )
                        )
                      : 100;
                  const initials = group.memberName
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase();

                  return (
                    <React.Fragment key={group.memberId}>
                      {/* ROW 1: DISTINCT MEMBER INFORMATION */}
                      <tr
                        onClick={() => toggleExpandMember(group.memberId)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded
                            ? "bg-emerald-50/40 hover:bg-emerald-50/70"
                            : "hover:bg-slate-50/80"
                        }`}
                      >
                        {/* Borrower */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpandMember(group.memberId);
                              }}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-colors ${
                                isExpanded
                                  ? "bg-emerald-600 text-white border-emerald-600"
                                  : "bg-white text-slate-500 border-slate-300 hover:bg-slate-100"
                              }`}
                              title={
                                isExpanded
                                  ? "Collapse member loan portfolio"
                                  : "Expand member loan portfolio"
                              }
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>

                            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                              {initials}
                            </div>

                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-2">
                                <span>{group.memberName}</span>
                                <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  {group.memberCode}
                                </span>
                              </div>
                              {group.email && (
                                <div className="text-[11px] text-slate-400">
                                  {group.email}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Loan Standing */}
                        <td className="py-4 px-4 text-center">
                          <div className="inline-flex flex-col items-center">
                            {group.activeLoansCount > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
                                <HandCoins className="w-3 h-3 text-sky-600" />
                                {group.activeLoansCount} Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                                0 Active
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400 mt-0.5">
                              {group.totalLoansCount} Total ({group.paidLoansCount} Paid)
                            </span>
                          </div>
                        </td>

                        {/* Active Principal */}
                        <td className="py-4 px-4 text-right">
                          <div className="font-mono font-bold text-slate-900">
                            {formatCurrency(group.activePrincipal)}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            Lifetime: {formatCurrency(group.lifetimePrincipal)}
                          </div>
                        </td>

                        {/* Repayment Progress */}
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-mono font-semibold text-emerald-700 text-xs">
                              {formatCurrency(group.activePrincipalPaid)}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {progressPct}%
                            </span>
                          </div>
                          <div className="w-28 ml-auto bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </td>

                        {/* Total Active Balance */}
                        <td className="py-4 px-4 text-right">
                          <span className="font-mono font-extrabold text-base text-slate-900">
                            {formatCurrency(group.totalActiveBalance)}
                          </span>
                        </td>

                        {/* Semi-Monthly Due */}
                        <td className="py-4 px-4 text-right">
                          <div className="font-mono font-semibold text-slate-800">
                            {formatCurrency(group.activeCutoffAmortization)}
                          </div>
                          <div className="text-[11px] text-slate-400">per cutoff</div>
                        </td>

                        {/* Late Penalties */}
                        <td className="py-4 px-4 text-right">
                          {group.totalLatePenalties > 0 ? (
                            <span className="font-mono font-bold text-amber-800 text-xs px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
                              {formatCurrency(group.totalLatePenalties)}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs font-mono">
                              ₱0.00
                            </span>
                          )}
                        </td>

                        {/* Expand Action */}
                        <td className="py-4 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpandMember(group.memberId);
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                              isExpanded
                                ? "bg-emerald-600 text-white shadow-2xs"
                                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                            }`}
                          >
                            <span>
                              {isExpanded
                                ? "Hide Portfolio"
                                : `Portfolio (${group.totalLoansCount})`}
                            </span>
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* SUB-ROW 1: MEMBER LOAN PORTFOLIO (Active, Inactive, or Paid) */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90">
                          <td colSpan={8} className="p-0">
                            <div className="px-6 py-4 border-l-4 border-emerald-600 bg-slate-50/90 space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-emerald-600" />
                                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                                    Loan Portfolio — {group.memberName} ({group.totalLoansCount}{" "}
                                    {group.totalLoansCount === 1 ? "Loan" : "Loans"})
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  Includes all active, pending, and paid loan accounts for this member
                                </div>
                              </div>

                              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase text-[11px] border-b border-slate-200">
                                      <tr>
                                        <th className="py-2.5 px-3.5">Reference</th>
                                        <th className="py-2.5 px-3.5 text-right">Principal</th>
                                        <th className="py-2.5 px-3.5 text-right">Upfront Int.</th>
                                        <th className="py-2.5 px-3.5 text-right">Net Release</th>
                                        <th className="py-2.5 px-3.5 text-right">Amortizations</th>
                                        <th className="py-2.5 px-3.5 text-right">Remaining Bal.</th>
                                        <th className="py-2.5 px-3.5 text-right">Late Penalties</th>
                                        <th className="py-2.5 px-3.5 text-center">Status</th>
                                        <th className="py-2.5 px-3.5 text-right">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {group.loans.map((loan) => {
                                        const remBalance = Math.max(
                                          0,
                                          (Number(loan.principalAmount) || 0) -
                                            (Number(loan.totalRepayments) || 0)
                                        );
                                        const ratePercent = (
                                          (Number(loan.interestRate) || 0.05) * 100
                                        ).toFixed(1);
                                        const loanTotalPenalties =
                                          loanSchedulePenaltiesMap.get(loan.id) ??
                                          (Number(loan.totalLatePenalties) || 0);

                                        return (
                                          <tr
                                            key={loan.id}
                                            className="hover:bg-slate-50/80 transition-colors"
                                          >
                                            {/* Reference */}
                                            <td className="py-3 px-3.5">
                                              <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                                                <FileText className="w-3.5 h-3.5 text-slate-400" />
                                                {loan.loanReference}
                                              </div>
                                              <div className="text-[10px] text-slate-400 mt-0.5">
                                                Originated{" "}
                                                {new Date(
                                                  loan.originationDate
                                                ).toLocaleDateString("en-US", {
                                                  month: "short",
                                                  day: "numeric",
                                                  year: "numeric",
                                                })}
                                              </div>
                                            </td>

                                            {/* Principal */}
                                            <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900">
                                              {formatCurrency(loan.principalAmount)}
                                            </td>

                                            {/* Upfront Int. */}
                                            <td className="py-3 px-3.5 text-right font-mono text-amber-700 font-semibold">
                                              <div>{formatCurrency(loan.interestEarned)}</div>
                                              <div className="text-[10px] text-slate-400">
                                                ({ratePercent}% flat)
                                              </div>
                                            </td>

                                            {/* Net Release */}
                                            <td className="py-3 px-3.5 text-right font-mono text-emerald-700 font-semibold">
                                              {formatCurrency(loan.releasedAmount)}
                                            </td>

                                            {/* Amortizations */}
                                            <td className="py-3 px-3.5 text-right">
                                              <div className="font-mono font-bold text-slate-900">
                                                {formatCurrency(loan.cutoffPaymentAmount)}
                                              </div>
                                              <div className="text-[10px] text-slate-400">
                                                {loan.cutoffsCount} cutoffs ({loan.termMonths} mos)
                                              </div>
                                            </td>

                                            {/* Remaining Balance */}
                                            <td className="py-3 px-3.5 text-right font-mono">
                                              <div
                                                className={`font-bold ${
                                                  remBalance > 0
                                                    ? "text-slate-900"
                                                    : "text-emerald-700"
                                                }`}
                                              >
                                                {formatCurrency(remBalance)}
                                              </div>
                                              <div className="text-[10px] text-slate-400">
                                                Paid: {formatCurrency(loan.totalRepayments)}
                                              </div>
                                            </td>

                                            {/* Late Penalties */}
                                            <td className="py-3 px-3.5 text-right font-mono">
                                              {loanTotalPenalties > 0 ? (
                                                <span className="font-bold text-amber-800 px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
                                                  {formatCurrency(loanTotalPenalties)}
                                                </span>
                                              ) : (
                                                <span className="text-slate-400">₱0.00</span>
                                              )}
                                            </td>

                                            {/* Status */}
                                            <td className="py-3 px-3.5 text-center">
                                              {getStatusBadge(loan.status)}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3 px-3.5 text-right">
                                              <div className="flex items-center justify-end gap-1.5">
                                                {/* Payment History & Amortization Schedule Modal */}
                                                <button
                                                  type="button"
                                                  onClick={() => setSelectedLoanForSchedule(loan)}
                                                  className="px-2.5 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                                  title="View loan payment history & amortization schedule"
                                                >
                                                  <History className="w-3.5 h-3.5 text-emerald-600" />
                                                  Payment History
                                                </button>

                                                {loan.status === "PENDING_APPROVAL" && (
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      updateStatusMutation.mutate({
                                                        loanId: loan.id,
                                                        status: "APPROVED",
                                                      })
                                                    }
                                                    className="px-2.5 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                                                  >
                                                    Approve
                                                  </button>
                                                )}
                                                {loan.status === "APPROVED" && (
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      updateStatusMutation.mutate({
                                                        loanId: loan.id,
                                                        status: "ACTIVE",
                                                      })
                                                    }
                                                    className="px-2.5 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                                                  >
                                                    Disburse
                                                  </button>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && filteredGroups.length > 0 && (
          <TablePagination
            page={page}
            pageSize={pageSize}
            totalItems={filteredGroups.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            itemLabel="borrowers"
          />
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
        isOpen={Boolean(selectedLoanForSchedule) && !isPenaltiesModalOpen}
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
