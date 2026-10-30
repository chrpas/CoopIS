import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  BatchContributionItem,
  BatchContributionResult,
  PaymentChannel,
} from "../../types";
import { useToast } from "../../components/ui/Toast";
import {
  Calendar,
  Save,
  RotateCcw,
  Search,
  ArrowUpDown,
  TrendingUp,
  Users,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Building2,
  Lock,
  Unlock,
  Coins,
  History,
} from "lucide-react";

interface EditableRowData extends CutoffMemberContribution {
  isModified?: boolean;
}

export const ContributionsPage: React.FC = () => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Selected Cutoff State
  const [selectedCutoffId, setSelectedCutoffId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [activeTab, setActiveTab] = useState<"entry" | "summary">("entry");

  // Grid local state for high-velocity editing
  const [gridData, setGridData] = useState<EditableRowData[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // References to amount input elements by member index for keyboard navigation
  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

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
      setGridData(
        serverCutoffContributions.map((item) => ({
          ...item,
          isModified: false,
        }))
      );
      setIsDirty(false);
    } else {
      setGridData([]);
      setIsDirty(false);
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

  // 4. Batch Save & Post Mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: BatchContributionItem[]) => {
      const res = await api.post<BatchContributionResult>("/contributions/batch", payload);
      return res.data;
    },
    onMutate: async (newContributions) => {
      // Cancel queries to avoid overwriting optimistic data
      await queryClient.cancelQueries({
        queryKey: ["contributions-cutoff", selectedCutoffId],
      });

      // Snapshot previous value
      const previousContributions = queryClient.getQueryData<CutoffMemberContribution[]>([
        "contributions-cutoff",
        selectedCutoffId,
      ]);

      // Optimistically update
      if (previousContributions) {
        const updated = previousContributions.map((item) => {
          const match = newContributions.find((n) => n.memberId === item.memberId);
          if (match) {
            return {
              ...item,
              amount: match.amount,
              paymentChannel: match.paymentChannel || item.paymentChannel,
              recordedAt: new Date().toISOString(),
            };
          }
          return item;
        });
        queryClient.setQueryData(["contributions-cutoff", selectedCutoffId], updated);
      }

      return { previousContributions };
    },
    onSuccess: (data) => {
      showToast(
        "success",
        "Cutoff Contributions Posted",
        data.message || `Successfully processed ${data.totalProcessed} records.`
      );
      setIsDirty(false);
      // Invalidate to ensure freshness with server totals
      queryClient.invalidateQueries({
        queryKey: ["contributions-cutoff", selectedCutoffId],
      });
      queryClient.invalidateQueries({
        queryKey: ["contributions-summary"],
      });
    },
    onError: (err: any, _newContributions, context) => {
      if (context?.previousContributions) {
        queryClient.setQueryData(
          ["contributions-cutoff", selectedCutoffId],
          context.previousContributions
        );
      }
      const errorMsg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        "Failed to post cutoff contributions.";
      showToast("error", "Financial Validation Error", errorMsg);
    },
  });

  // Handle amount edit for a single member
  const handleAmountChange = useCallback((memberId: string, val: string) => {
    // Sanitize non-numeric characters except decimal
    const cleanVal = val.replace(/[^0-9.]/g, "");
    const parsedAmount = cleanVal === "" ? 0 : parseFloat(cleanVal);

    setGridData((prev) =>
      prev.map((row) => {
        if (row.memberId === memberId) {
          return {
            ...row,
            amount: isNaN(parsedAmount) ? 0 : parsedAmount,
            isModified: true,
          };
        }
        return row;
      })
    );
    setIsDirty(true);
  }, []);

  // Handle payment channel change
  const handleChannelChange = useCallback((memberId: string, channel: PaymentChannel) => {
    setGridData((prev) =>
      prev.map((row) => {
        if (row.memberId === memberId) {
          return {
            ...row,
            paymentChannel: channel,
            isModified: true,
          };
        }
        return row;
      })
    );
    setIsDirty(true);
  }, []);

  // Excel Copy-Paste handler for high-velocity payroll data entry
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>, startRowIndex: number) => {
      e.preventDefault();
      const clipboardText = e.clipboardData.getData("text");
      if (!clipboardText) return;

      // Split lines (handles \r\n and \n)
      const lines = clipboardText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (lines.length === 0) return;

      const pastedValues: number[] = [];
      let hasNegative = false;

      for (const line of lines) {
        // If row has tabs (e.g. copied multi-columns from Excel), take first column or clean
        const firstCol = line.split("\t")[0].trim();
        // Remove currency symbols (₱, $, PHP), commas, spaces
        const sanitized = firstCol.replace(/[₱$PHP,\s]/gi, "");
        const num = parseFloat(sanitized);

        if (!isNaN(num)) {
          if (num < 0) {
            hasNegative = true;
          }
          pastedValues.push(Math.max(0, num));
        }
      }

      if (hasNegative) {
        showToast(
          "warning",
          "Negative Values Detected",
          "Negative values in the clipboard were clamped to ₱0.00 as co-op rules prohibit negative contributions."
        );
      }

      if (pastedValues.length === 0) {
        showToast("error", "Paste Failed", "No valid numerical values were detected in clipboard.");
        return;
      }

      // Update the rows starting from startRowIndex
      setGridData((prev) => {
        const next = [...prev];
        let pastedCount = 0;
        for (let i = 0; i < pastedValues.length; i++) {
          const targetIndex = startRowIndex + i;
          if (targetIndex < next.length) {
            next[targetIndex] = {
              ...next[targetIndex],
              amount: pastedValues[i],
              isModified: true,
            };
            pastedCount++;
          }
        }
        return next;
      });

      setIsDirty(true);
      showToast(
        "success",
        "Excel Data Pasted",
        `Pasted ${Math.min(
          pastedValues.length,
          gridData.length - startRowIndex
        )} values directly into the cutoff column.`
      );
    },
    [gridData.length, showToast]
  );

  // Keyboard navigation handler: Enter/Tab moves to next row, Shift+Enter to previous
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number) => {
      if (e.key === "Enter" || e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = e.shiftKey ? rowIndex - 1 : rowIndex + 1;
        if (nextIndex >= 0 && nextIndex < gridData.length) {
          const nextInput = inputRefs.current.get(nextIndex);
          if (nextInput) {
            nextInput.focus();
            nextInput.select();
          }
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex = rowIndex - 1;
        if (prevIndex >= 0) {
          const prevInput = inputRefs.current.get(prevIndex);
          if (prevInput) {
            prevInput.focus();
            prevInput.select();
          }
        }
      }
    },
    [gridData.length]
  );

  // Discard local changes and reset to server values
  const handleDiscard = useCallback(() => {
    if (serverCutoffContributions.length > 0) {
      setGridData(
        serverCutoffContributions.map((item) => ({
          ...item,
          isModified: false,
        }))
      );
      setIsDirty(false);
      showToast("info", "Changes Discarded", "Reset back to last recorded server state.");
    }
  }, [serverCutoffContributions, showToast]);

  // Bulk fill utility for rapid test/payroll operations
  const handleBulkFill = useCallback(
    (defaultAmount: number) => {
      setGridData((prev) =>
        prev.map((row) => ({
          ...row,
          amount: defaultAmount,
          isModified: true,
        }))
      );
      setIsDirty(true);
      showToast(
        "info",
        "Bulk Pre-filled",
        `Set ₱${defaultAmount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
        })} across all active members.`
      );
    },
    [showToast]
  );

  // Submit batch to backend
  const handleSaveAndPost = useCallback(() => {
    if (!selectedCutoffId) {
      showToast("error", "No Cutoff Selected", "Please select a valid cutoff period first.");
      return;
    }

    // Financial Validation before sending
    const invalidItem = gridData.find((item) => item.amount < 0);
    if (invalidItem) {
      showToast(
        "error",
        "Financial Validation Error",
        `Negative amount detected for ${invalidItem.memberName}. Cannot post negative contributions.`
      );
      return;
    }

    const payload: BatchContributionItem[] = gridData.map((item) => ({
      memberId: item.memberId,
      cutoffId: selectedCutoffId,
      amount: item.amount || 0,
      paymentChannel: item.paymentChannel,
    }));

    saveMutation.mutate(payload);
  }, [selectedCutoffId, gridData, saveMutation, showToast]);

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
        accessorKey: "paymentChannel",
        header: "Payment Channel",
        cell: ({ row }) => (
          <select
            value={row.original.paymentChannel}
            onChange={(e) =>
              handleChannelChange(row.original.memberId, e.target.value as PaymentChannel)
            }
            className="text-xs font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
          >
            <option value="PAYROLL_DEDUCTION">Payroll Deduction</option>
            <option value="CASH">Cash Deposit</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </select>
        ),
      },
      {
        accessorKey: "amount",
        header: () => (
          <div className="flex items-center justify-end gap-1.5">
            <Coins className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-semibold text-xs tracking-wider uppercase text-slate-600">
              Contribution (₱)
            </span>
          </div>
        ),
        cell: ({ row }) => {
          const isModified = row.original.isModified;
          const index = row.index;

          return (
            <div className="flex items-center justify-end gap-2">
              {isModified && (
                <span
                  className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"
                  title="Unsaved changes"
                />
              )}
              <div className="relative w-44">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  ₱
                </span>
                <input
                  ref={(el) => {
                    if (el) {
                      inputRefs.current.set(index, el);
                    } else {
                      inputRefs.current.delete(index);
                    }
                  }}
                  type="text"
                  inputMode="decimal"
                  value={row.original.amount === 0 ? "" : row.original.amount}
                  placeholder="0.00"
                  onChange={(e) => handleAmountChange(row.original.memberId, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onPaste={(e) => handlePaste(e, index)}
                  onFocus={(e) => e.target.select()}
                  className={`w-full text-right font-mono font-bold text-sm pl-7 pr-3 py-1.5 rounded-lg border transition-all focus:outline-none focus:ring-2 ${
                    isModified
                      ? "bg-amber-50/50 border-amber-300 text-amber-950 focus:ring-amber-400/30 focus:border-amber-500"
                      : row.original.amount > 0
                      ? "bg-emerald-50/30 border-slate-300 text-emerald-950 focus:ring-emerald-500/30 focus:border-emerald-600"
                      : "bg-white border-slate-200 text-slate-800 focus:ring-slate-400/20 focus:border-slate-400"
                  }`}
                />
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "recordedAt",
        header: () => <div className="text-right">Ledger Status</div>,
        cell: ({ row }) => {
          const isRecorded = !!row.original.contributionId;
          return (
            <div className="text-right">
              {isRecorded ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Recorded
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  Unrecorded
                </span>
              )}
            </div>
          );
        },
      },
    ],
    [handleAmountChange, handleChannelChange, handleKeyDown, handlePaste]
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

            {/* Quick Actions & Save Button */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Keyboard shortcuts & Excel helper tooltip banner */}
              <div className="hidden xl:flex items-center gap-2 text-[11px] text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-xl">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  Paste Excel column (<kbd className="font-mono bg-slate-100 px-1 rounded">Ctrl+V</kbd>) or navigate with <kbd className="font-mono bg-slate-100 px-1 rounded">Enter</kbd> / <kbd className="font-mono bg-slate-100 px-1 rounded">Tab</kbd>
                </span>
              </div>

              {/* Pre-fill presets */}
              <div className="flex items-center gap-1 border border-slate-200 rounded-xl bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => handleBulkFill(1000)}
                  className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors"
                  title="Preset ₱1,000 for all members"
                >
                  Set ₱1K
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkFill(2500)}
                  className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors"
                  title="Preset ₱2,500 for all members"
                >
                  Set ₱2.5K
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkFill(0)}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors"
                  title="Clear all amounts to 0"
                >
                  Clear
                </button>
              </div>

              {/* Discard button */}
              {isDirty && (
                <button
                  type="button"
                  onClick={handleDiscard}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl transition-colors shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Discard
                </button>
              )}

              {/* Save & Post Cutoff Button */}
              <button
                type="button"
                onClick={handleSaveAndPost}
                disabled={saveMutation.isPending || !selectedCutoffId}
                className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm ${
                  isDirty
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-500/20 shadow-emerald-700/20 animate-pulse hover:animate-none"
                    : "bg-slate-900 hover:bg-slate-800 text-white"
                } ${saveMutation.isPending ? "opacity-75 cursor-not-allowed" : ""}`}
              >
                {saveMutation.isPending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Posting Cutoff...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save & Post Cutoff
                    {isDirty && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 ml-0.5" />
                    )}
                  </>
                )}
              </button>
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
                      className={`hover:bg-slate-50/80 transition-colors ${
                        row.original.isModified ? "bg-amber-50/20" : ""
                      }`}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default ContributionsPage;
