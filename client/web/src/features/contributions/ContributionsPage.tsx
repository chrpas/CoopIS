import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  ColumnDef,
  flexRender,
  SortingState,
} from "@tanstack/react-table";
import { api } from "../../services/api";
import {
  CutoffPeriod,
  CutoffMemberContribution,
  ContributionSummary,
} from "../../types";
import { useToast } from "../../components/ui/Toast";
import { MemberDetailsDrawer } from "../members/MemberDetailsDrawer";
import { ContributionModal } from "./ContributionModal";
import {
  Calendar,
  Search,
  ArrowUpDown,
  TrendingUp,
  Users,
  CheckCircle2,
  AlertCircle,
  Building2,
  Lock,
  Unlock,
  Coins,
  History,
  Eye,
  Plus,
} from "lucide-react";

interface EditableRowData extends CutoffMemberContribution {}

export const ContributionsPage: React.FC = () => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Selected Cutoff State
  const [selectedCutoffId, setSelectedCutoffId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [activeTab, setActiveTab] = useState<"entry" | "summary">("entry");

  // Grid local state
  const [gridData, setGridData] = useState<EditableRowData[]>([]);
  const [selectedMemberForModal, setSelectedMemberForModal] = useState<EditableRowData | null>(null);
  const [selectedMemberIdForDrawer, setSelectedMemberIdForDrawer] = useState<string | null>(null);

  // 1. Fetch Cutoff Periods
  const { data: cutoffs = [], isLoading: isLoadingCutoffs } = useQuery<CutoffPeriod[]>({
    queryKey: ["cutoff-periods"],
    queryFn: async () => {
      const res = await api.get<CutoffPeriod[]>("/cutoff-periods");
      return res.data;
    },
  });

  // Auto-select initial cutoff (first open or first available)
  useEffect(() => {
    if (cutoffs.length > 0 && !selectedCutoffId) {
      const firstOpen = cutoffs.find((c) => !c.isClosed) || cutoffs[0];
      setSelectedCutoffId(firstOpen.id);
    }
  }, [cutoffs, selectedCutoffId]);

  // Current selected cutoff object
  const selectedCutoff = useMemo(
    () => cutoffs.find((c) => c.id === selectedCutoffId),
    [cutoffs, selectedCutoffId]
  );

  // 2. Fetch Contributions for the selected Cutoff
  const {
    data: serverCutoffContributions = [],
    isLoading: isLoadingCutoffData,
    isFetching: isFetchingCutoffData,
  } = useQuery<CutoffMemberContribution[]>({
    queryKey: ["contributions-cutoff", selectedCutoffId],
    queryFn: async () => {
      if (!selectedCutoffId) return [];
      const res = await api.get<CutoffMemberContribution[]>(
        `/contributions/cutoff/${selectedCutoffId}`
      );
      return res.data;
    },
    enabled: !!selectedCutoffId,
  });

  // Sync server data to local editable grid state
  useEffect(() => {
    if (serverCutoffContributions.length > 0) {
      setGridData(serverCutoffContributions);
    } else {
      setGridData([]);
    }
  }, [serverCutoffContributions]);

  // 3. Fetch Cooperative Summary (Grand capital, active members, member cumulative)
  const { data: summaryData, isLoading: isLoadingSummary } = useQuery<ContributionSummary>({
    queryKey: ["contributions-summary"],
    queryFn: async () => {
      const res = await api.get<ContributionSummary>("/contributions/summary");
      return res.data;
    },
  });

  // 4. Finalize Cutoff Mutation (POST /api/cutoffs/{id}/finalize)
  const finalizeMutation = useMutation({
    mutationFn: async (cutoffId: string) => {
      const res = await api.post(`/cutoffs/${cutoffId}/finalize`);
      return res.data;
    },
    onSuccess: (data) => {
      showToast(
        "success",
        "Cutoff Locked & Finalized",
        data.message || `Cutoff period has been locked. Contributions are now read-only.`
      );
      queryClient.invalidateQueries({ queryKey: ["cutoff-periods"] });
      queryClient.invalidateQueries({ queryKey: ["contributions-cutoff", selectedCutoffId] });
      queryClient.invalidateQueries({ queryKey: ["contributions-summary"] });
    },
    onError: (err: any) => {
      const errorMsg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        "Failed to finalize cutoff.";
      showToast("error", "Finalize Error", errorMsg);
    },
  });

  // 5. Reopen Cutoff Mutation (POST /api/cutoffs/{id}/reopen)
  const reopenMutation = useMutation({
    mutationFn: async (cutoffId: string) => {
      const res = await api.post(`/cutoffs/${cutoffId}/reopen`);
      return res.data;
    },
    onSuccess: (data) => {
      showToast(
        "success",
        "Cutoff Reopened",
        data.message || `Cutoff period has been reopened for editing.`
      );
      queryClient.invalidateQueries({ queryKey: ["cutoff-periods"] });
      queryClient.invalidateQueries({ queryKey: ["contributions-cutoff", selectedCutoffId] });
      queryClient.invalidateQueries({ queryKey: ["contributions-summary"] });
    },
    onError: (err: any) => {
      const errorMsg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        "Failed to reopen cutoff.";
      showToast("error", "Reopen Error", errorMsg);
    },
  });

  // Calculations for Summary Banner
  const totalThisCutoff = useMemo(() => {
    return gridData.reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
  }, [gridData]);

  const contributingMembersThisCutoff = useMemo(() => {
    return gridData.filter((row) => (Number(row.amount) || 0) > 0).length;
  }, [gridData]);

  const completionPercent = useMemo(() => {
    if (gridData.length === 0) return 0;
    return Math.round((contributingMembersThisCutoff / gridData.length) * 100);
  }, [contributingMembersThisCutoff, gridData.length]);

  // TanStack Table Column Definitions
  const columns = useMemo<ColumnDef<EditableRowData>[]>(
    () => [
      {
        accessorKey: "memberCode",
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-1 font-semibold text-xs tracking-wider uppercase text-slate-600 hover:text-slate-900"
          >
            Member ID
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block">
            {row.original.memberCode}
          </div>
        ),
      },
      {
        accessorKey: "memberName",
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-1 font-semibold text-xs tracking-wider uppercase text-slate-600 hover:text-slate-900"
          >
            Member Name
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        ),
        cell: ({ row }) => {
          const isActive = row.original.status === "ACTIVE";
          return (
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">{row.original.memberName}</span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {row.original.status}
                </span>
              </div>
              <div className="text-xs text-slate-400">{row.original.email}</div>
            </div>
          );
        },
      },
      {
        accessorKey: "recordedAt",
        header: () => <div className="text-right">Ledger Status</div>,
        cell: ({ row }) => {
          const isRecorded = Boolean(row.original.contributionId);
          const amount = Number(row.original.amount) || 0;

          return (
            <div className="flex flex-col items-end">
              {isRecorded ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-sm text-emerald-800">
                      ₱{amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Recorded
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 capitalize mt-0.5">
                    {row.original.paymentChannel?.toLowerCase().replace(/_/g, " ")}
                  </span>
                </>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  Unrecorded
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Action</div>,
        cell: ({ row }) => {
          return (
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedMemberForModal(row.original)}
                className="px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold border shadow-2xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border-emerald-200 hover:border-emerald-300"
                title="Record contribution for this cutoff"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                Record
              </button>

              <button
                type="button"
                onClick={() => setSelectedMemberIdForDrawer(row.original.memberId)}
                className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                title="View member statement and history"
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          );
        },
      },
    ],
    []
  );

  // Filter grid by search term
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return gridData;
    const term = searchTerm.toLowerCase();
    return gridData.filter(
      (m) =>
        m.memberName.toLowerCase().includes(term) ||
        m.memberCode.toLowerCase().includes(term) ||
        m.email.toLowerCase().includes(term)
    );
  }, [gridData, searchTerm]);

  // TanStack Table Instance
  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-6">
      {/* 1. Header & Cutoff Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Capital Build-Up & Share Contributions
            </h2>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Admin Master Entry
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Semi-monthly member payroll deductions, share capital postings, and ledger reconciliation.
          </p>
        </div>

        {/* Cutoff Selector & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3.5 py-1.5 rounded-xl shadow-xs">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <label htmlFor="cutoff-select" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Cutoff:
            </label>
            <select
              id="cutoff-select"
              value={selectedCutoffId}
              onChange={(e) => setSelectedCutoffId(e.target.value)}
              disabled={isLoadingCutoffs}
              className="text-sm font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
            >
              {isLoadingCutoffs ? (
                <option>Loading cutoffs...</option>
              ) : (
                cutoffs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} ({c.fiscalYear}) {c.isClosed ? "— [Closed]" : "— [Open]"}
                  </option>
                ))
              )}
            </select>
            {selectedCutoff?.isClosed ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                <Lock className="w-3 h-3" /> Closed
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <Unlock className="w-3 h-3" /> Open
              </span>
            )}
          </div>

          {/* Tab switcher: Entry Grid vs Cumulative Summary */}
          <div className="bg-slate-200/80 p-1 rounded-xl flex items-center gap-1">
            <button
              onClick={() => setActiveTab("entry")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "entry"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Data Entry Grid
            </button>
            <button
              onClick={() => setActiveTab("summary")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "summary"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Cumulative Ledgers
            </button>
          </div>
        </div>
      </div>

      {/* 2. Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total collected this cutoff */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs relative overflow-hidden group hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
              This Cutoff Total
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono tracking-tight">
            ₱{totalThisCutoff.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Active Cutoff: {selectedCutoff?.label || "—"}</span>
          </div>
        </div>

        {/* Grand Cooperative Capital */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs relative overflow-hidden group hover:border-blue-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
              Grand Share Capital
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono tracking-tight">
            ₱
            {(summaryData?.grandTotalShareCapital || 0).toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-medium">
            Accumulated cooperative equity
          </div>
        </div>

        {/* Active Contributing Members */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs relative overflow-hidden group hover:border-purple-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
              Contributing Members
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 font-mono tracking-tight">
            {summaryData?.activeContributingMembersCount || 0}
            <span className="text-sm font-normal text-slate-400 ml-1">
              / {summaryData?.totalMembersCount || gridData.length} active
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 font-medium">
            Avg: ₱
            {(summaryData?.averageContributionPerMember || 0).toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}
            /member
          </div>
        </div>

        {/* Progress Counter & Bar */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs relative overflow-hidden group hover:border-amber-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
              Cutoff Progress
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-2xl font-black text-slate-900 font-mono">
              {contributingMembersThisCutoff} / {gridData.length}
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {completionPercent}%
            </span>
          </div>
          {/* Visual Progress Bar */}
          <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-600 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>
      </div>

      {activeTab === "entry" ? (
        /* 3. High-Velocity Data Entry Grid */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          {/* Table Toolbar */}
          <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by member name, code, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs font-medium pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>
            </div>

            {/* Lock & Finalize Cutoff Button */}
            <div className="flex items-center gap-2.5">

              {/* Lock & Finalize Cutoff Button */}
              {selectedCutoff?.isClosed ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-slate-100 text-slate-500 border border-slate-200 shadow-xs">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    Cutoff Finalized
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Reopen cutoff "${selectedCutoff.label}" for editing?`)) {
                        reopenMutation.mutate(selectedCutoff.id);
                      }
                    }}
                    disabled={reopenMutation.isPending}
                    className="text-xs font-semibold px-2.5 py-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                    title="Reopen cutoff for editing"
                  >
                    {reopenMutation.isPending ? "Reopening..." : "Reopen"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedCutoffId) return;
                    if (
                      window.confirm(
                        `Lock and finalize cutoff "${selectedCutoff?.label}"?\n\nOnce locked, contributions will be finalized and become read-only.`
                      )
                    ) {
                      finalizeMutation.mutate(selectedCutoffId);
                    }
                  }}
                  disabled={finalizeMutation.isPending || !selectedCutoffId}
                  className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50"
                  title="Lock and finalize this cutoff period"
                >
                  {finalizeMutation.isPending ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Finalizing...
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 text-emerald-400" />
                      Lock & Finalize Cutoff
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            {isLoadingCutoffData || isFetchingCutoffData ? (
              <div className="py-20 text-center">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-500 font-medium">Loading members and cutoff contributions...</p>
              </div>
            ) : gridData.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold">No members found in system registry.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th key={header.id} className="py-3 px-4">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="py-3 px-4">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Table Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500 gap-2">
            <div>
              Showing <span className="font-bold text-slate-800">{filteredData.length}</span> members in cutoff{" "}
              <span className="font-bold text-slate-800">{selectedCutoff?.label}</span>.
            </div>
            <div className="flex items-center gap-4">
              <span>
                Total Batch Amount:{" "}
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  ₱{totalThisCutoff.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* 4. Cumulative Ledgers & Summary View */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-600" />
                Member Cumulative Capital Ledgers
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Total lifetime contributions, count of cutoffs remitted, and recent activity.
              </p>
            </div>
          </div>

          {isLoadingSummary ? (
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">Loading cumulative ledgers...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Member ID</th>
                    <th className="py-3 px-4">Member Name</th>
                    <th className="py-3 px-4 text-center">Cutoffs Remitted</th>
                    <th className="py-3 px-4 text-right">Total Cumulative Capital (₱)</th>
                    <th className="py-3 px-4 text-right">Last Contribution</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(summaryData?.memberContributions || []).map((m) => (
                    <tr key={m.memberId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {m.memberCode}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{m.memberName}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {m.contributionsCount} {m.contributionsCount === 1 ? "cutoff" : "cutoffs"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-emerald-700 text-sm">
                        ₱{m.totalContribution.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right text-xs text-slate-500">
                        {m.lastContributionDate
                          ? new Date(m.lastContributionDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "None"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedMemberIdForDrawer(m.memberId)}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors inline-flex items-center"
                          title="View member statement and history"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Record / Edit Contribution */}
      <ContributionModal
        isOpen={Boolean(selectedMemberForModal)}
        onClose={() => setSelectedMemberForModal(null)}
        member={selectedMemberForModal}
        cutoff={selectedCutoff || null}
      />

      {/* Drawer: Member Details & Ledger */}
      <MemberDetailsDrawer
        memberId={selectedMemberIdForDrawer}
        isOpen={Boolean(selectedMemberIdForDrawer)}
        onClose={() => setSelectedMemberIdForDrawer(null)}
      />
    </div>
  );
};
export default ContributionsPage;
