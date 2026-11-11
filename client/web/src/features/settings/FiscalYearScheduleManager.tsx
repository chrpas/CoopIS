import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  ChevronDown,
  Search,
  Lock,
  Unlock,
  Plus,
  Check,
  Clock,
  X,
} from "lucide-react";
import { api } from "../../services/api";
import { CutoffPeriod } from "../../types";

interface FiscalYearSummary {
  fiscalYear: number;
  total: number;
  openCount: number;
  closedCount: number;
  cutoffs: CutoffPeriod[];
  status: "Active" | "Closed" | "Future";
}

interface FiscalYearScheduleManagerProps {
  onFeedback?: (feedback: { type: "success" | "error"; message: string }) => void;
  currentActiveYear?: number;
}

export const FiscalYearScheduleManager: React.FC<FiscalYearScheduleManagerProps> = ({
  onFeedback,
  currentActiveYear = 2026,
}) => {
  const queryClient = useQueryClient();

  // 1. Fetch Cutoff Periods
  const { data: cutoffs = [], isLoading: isLoadingCutoffs } = useQuery<CutoffPeriod[]>({
    queryKey: ["cutoff-periods"],
    queryFn: async () => {
      const res = await api.get<CutoffPeriod[]>("/cutoff-periods");
      return res.data;
    },
  });

  // 2. Group cutoffs by fiscal year (sorted chronologically descending)
  const fiscalYearSummaries: FiscalYearSummary[] = useMemo(() => {
    const map = new Map<
      number,
      { fiscalYear: number; total: number; openCount: number; closedCount: number; cutoffs: CutoffPeriod[] }
    >();

    for (const c of cutoffs) {
      const existing = map.get(c.fiscalYear) || {
        fiscalYear: c.fiscalYear,
        total: 0,
        openCount: 0,
        closedCount: 0,
        cutoffs: [],
      };
      existing.total += 1;
      if (c.isClosed) existing.closedCount += 1;
      else existing.openCount += 1;
      existing.cutoffs.push(c);
      map.set(c.fiscalYear, existing);
    }

    const currentYear = new Date().getFullYear();

    return Array.from(map.values())
      .map((item) => {
        let status: "Active" | "Closed" | "Future" = "Active";
        if (item.openCount === 0 && item.total > 0) {
          status = "Closed";
        } else if (item.fiscalYear > currentYear && item.closedCount === 0) {
          status = "Future";
        } else {
          status = "Active";
        }

        // Sort cutoffs within year chronologically
        item.cutoffs.sort(
          (a, b) => new Date(a.cutoffDate).getTime() - new Date(b.cutoffDate).getTime()
        );

        return {
          ...item,
          status,
        };
      })
      .sort((a, b) => b.fiscalYear - a.fiscalYear);
  }, [cutoffs]);

  // Max fiscal year generated so far
  const maxFiscalYear = useMemo(() => {
    return fiscalYearSummaries.length > 0
      ? fiscalYearSummaries[0].fiscalYear
      : new Date().getFullYear();
  }, [fiscalYearSummaries]);

  // Selected schedule year in view
  const [selectedScheduleYear, setSelectedScheduleYear] = useState<number | null>(null);
  const [targetFiscalYearInput, setTargetFiscalYearInput] = useState<string>("");

  // Combobox Popover state
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const comboboxRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  // Initialize selected year
  useEffect(() => {
    if (fiscalYearSummaries.length > 0 && selectedScheduleYear === null) {
      // Prioritize current active year or first active summary
      const activeSummary =
        fiscalYearSummaries.find((s) => s.fiscalYear === currentActiveYear) ||
        fiscalYearSummaries.find((s) => s.openCount > 0) ||
        fiscalYearSummaries[0];
      setSelectedScheduleYear(activeSummary.fiscalYear);
    }
    if (!targetFiscalYearInput && maxFiscalYear) {
      setTargetFiscalYearInput(String(maxFiscalYear + 1));
    }
  }, [fiscalYearSummaries, selectedScheduleYear, maxFiscalYear, currentActiveYear, targetFiscalYearInput]);

  // Filtered fiscal years based on search input
  const filteredSummaries = useMemo(() => {
    if (!searchQuery.trim()) return fiscalYearSummaries;
    const q = searchQuery.toLowerCase().trim();
    return fiscalYearSummaries.filter(
      (s) =>
        s.fiscalYear.toString().includes(q) ||
        s.status.toLowerCase().includes(q)
    );
  }, [fiscalYearSummaries, searchQuery]);

  // Reset highlight index when search changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  // Auto-focus search input when popover opens
  useEffect(() => {
    if (isComboboxOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
    }
  }, [isComboboxOpen]);

  // Dismiss combobox on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setIsComboboxOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation for Combobox
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isComboboxOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsComboboxOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsComboboxOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredSummaries.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredSummaries.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredSummaries[highlightedIndex]) {
        setSelectedScheduleYear(filteredSummaries[highlightedIndex].fiscalYear);
        setIsComboboxOpen(false);
      }
    }
  };

  // Keep highlighted item in view during keyboard navigation
  useEffect(() => {
    if (isComboboxOpen && listboxRef.current) {
      const items = listboxRef.current.querySelectorAll("li");
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isComboboxOpen]);

  // Selected summary details
  const activeSelectedSummary = useMemo(() => {
    return fiscalYearSummaries.find((s) => s.fiscalYear === selectedScheduleYear) || null;
  }, [fiscalYearSummaries, selectedScheduleYear]);

  // Quick access years (e.g. 2025, 2026, 2027 or adjacent to active)
  const quickAccessYears = useMemo(() => {
    const baseYear = currentActiveYear || 2026;
    const candidates = [baseYear - 1, baseYear, baseYear + 1, baseYear + 2];
    // Return years that exist in summaries
    return candidates.filter((y) => fiscalYearSummaries.some((s) => s.fiscalYear === y));
  }, [fiscalYearSummaries, currentActiveYear]);

  // 3. Generate New Fiscal Year Mutation
  const generateFiscalYearMutation = useMutation({
    mutationFn: async (fiscalYear: number) => {
      const res = await api.post<{
        message: string;
        fiscalYear: number;
        alreadyExists: boolean;
        count: number;
        cutoffs: CutoffPeriod[];
      }>(`/cutoff-periods/generate/${fiscalYear}`);
      return res.data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["cutoff-periods"] });
      setSelectedScheduleYear(data.fiscalYear);
      setTargetFiscalYearInput(String(data.fiscalYear + 1));
      setIsComboboxOpen(false);
      onFeedback?.({
        type: "success",
        message: data.message,
      });
    },
    onError: (err: any) => {
      onFeedback?.({
        type: "error",
        message:
          err.response?.data?.message ||
          err.response?.data?.detail ||
          err.message ||
          "Failed to generate cutoff schedule.",
      });
    },
  });

  // 4. Batch Lock All Cutoffs for Fiscal Year
  const finalizeAllMutation = useMutation({
    mutationFn: async (fiscalYear: number) => {
      const res = await api.post(`/cutoff-periods/fiscal-year/${fiscalYear}/finalize-all`);
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cutoff-periods"] });
      onFeedback?.({
        type: "success",
        message: `All cutoff periods for Fiscal Year ${selectedScheduleYear} have been locked and finalized.`,
      });
    },
    onError: (err: any) => {
      onFeedback?.({
        type: "error",
        message: err.response?.data?.message || "Failed to finalize all cutoffs.",
      });
    },
  });

  // 5. Batch Reopen All Cutoffs for Fiscal Year
  const reopenAllMutation = useMutation({
    mutationFn: async (fiscalYear: number) => {
      const res = await api.post(`/cutoff-periods/fiscal-year/${fiscalYear}/reopen-all`);
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cutoff-periods"] });
      onFeedback?.({
        type: "success",
        message: `All cutoff periods for Fiscal Year ${selectedScheduleYear} have been reopened.`,
      });
    },
    onError: (err: any) => {
      onFeedback?.({
        type: "error",
        message: err.response?.data?.message || "Failed to reopen all cutoffs.",
      });
    },
  });

  // 6. Individual Cutoff Finalize / Reopen Mutation
  const toggleCutoffMutation = useMutation({
    mutationFn: async ({ id, isClosed }: { id: string; isClosed: boolean }) => {
      const endpoint = isClosed
        ? `/cutoff-periods/${id}/reopen`
        : `/cutoff-periods/${id}/finalize`;
      const res = await api.post(endpoint);
      return res.data;
    },
    onSuccess: async (data: any) => {
      await queryClient.invalidateQueries({ queryKey: ["cutoff-periods"] });
      onFeedback?.({
        type: "success",
        message: data?.message || "Cutoff period status updated.",
      });
    },
    onError: (err: any) => {
      onFeedback?.({
        type: "error",
        message: err.response?.data?.message || "Failed to update cutoff period status.",
      });
    },
  });

  const getStatusBadge = (status: "Active" | "Closed" | "Future", size = "sm") => {
    switch (status) {
      case "Active":
        return (
          <span
            className={`inline-flex items-center gap-1 font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 ${
              size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"
            }`}
          >
            <Unlock className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
            Active
          </span>
        );
      case "Closed":
        return (
          <span
            className={`inline-flex items-center gap-1 font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-200 ${
              size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"
            }`}
          >
            <Lock className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
            Closed
          </span>
        );
      case "Future":
        return (
          <span
            className={`inline-flex items-center gap-1 font-bold rounded-full bg-sky-100 text-sky-800 border border-sky-200 ${
              size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"
            }`}
          >
            <Clock className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
            Future
          </span>
        );
    }
  };

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
      {/* 1. Generator Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/60">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Fiscal Year & Cutoff Schedule Generator
            </h3>
            <p className="text-xs text-slate-500">
              Generate, inspect, and manage the 24 semi-monthly cutoff periods across all fiscal years.
            </p>
          </div>
        </div>

        {/* Generate New Fiscal Year Schedule Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const yr = parseInt(targetFiscalYearInput, 10);
            if (isNaN(yr) || yr < 2020 || yr > 2100) {
              onFeedback?.({
                type: "error",
                message: "Please enter a valid Fiscal Year between 2020 and 2100.",
              });
              return;
            }
            if (
              window.confirm(
                `Generate 24 semi-monthly cutoff periods (Jan-15 through Dec-31) for Fiscal Year ${yr}?`
              )
            ) {
              generateFiscalYearMutation.mutate(yr);
            }
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <label
              htmlFor="generate-fy-input"
              className="text-[11px] font-bold text-slate-500 uppercase tracking-wider"
            >
              Target FY:
            </label>
            <input
              id="generate-fy-input"
              type="number"
              min={2020}
              max={2100}
              value={targetFiscalYearInput}
              onChange={(e) => setTargetFiscalYearInput(e.target.value)}
              className="w-20 text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>
          <button
            type="submit"
            disabled={generateFiscalYearMutation.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {generateFiscalYearMutation.isPending ? "Generating..." : "Generate 24 Cutoffs"}
          </button>
        </form>
      </div>

      {/* 2. High-Density Fiscal Year Selector Bar */}
      {isLoadingCutoffs ? (
        <div className="py-12 text-center text-xs text-slate-400">
          Loading fiscal year schedules...
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Primary Searchable Combobox Trigger */}
            <div className="relative" ref={comboboxRef} onKeyDown={handleKeyDown}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:inline">
                  Select FY:
                </span>
                <button
                  type="button"
                  onClick={() => setIsComboboxOpen((prev) => !prev)}
                  aria-haspopup="listbox"
                  aria-expanded={isComboboxOpen}
                  className="inline-flex items-center justify-between gap-3 px-3.5 py-2 bg-white hover:bg-slate-50/80 active:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 shadow-2xs transition-all cursor-pointer min-w-[210px]"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>FY {selectedScheduleYear ?? "Select"}</span>
                    {activeSelectedSummary && getStatusBadge(activeSelectedSummary.status, "sm")}
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      isComboboxOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </div>

              {/* Popover Dropdown Menu */}
              {isComboboxOpen && (
                <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden text-xs animation-fade-in">
                  {/* Search Input with Autofocus */}
                  <div className="p-2.5 border-b border-slate-100 bg-slate-50/50">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search year (e.g. 2026, closed)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-medium"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Scroll-Capped Chronological List */}
                  <ul
                    ref={listboxRef}
                    role="listbox"
                    className="max-h-64 overflow-y-auto divide-y divide-slate-100"
                  >
                    {filteredSummaries.length === 0 ? (
                      <li className="p-4 text-center text-xs text-slate-400">
                        No fiscal years match &quot;{searchQuery}&quot;.
                      </li>
                    ) : (
                      filteredSummaries.map((summary, index) => {
                        const isSelected = selectedScheduleYear === summary.fiscalYear;
                        const isHighlighted = highlightedIndex === index;

                        return (
                          <li
                            key={summary.fiscalYear}
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              setSelectedScheduleYear(summary.fiscalYear);
                              setIsComboboxOpen(false);
                            }}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            className={`px-3.5 py-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-emerald-50/70 text-emerald-950 font-bold"
                                : isHighlighted
                                ? "bg-slate-50 text-slate-900"
                                : "text-slate-700 hover:bg-slate-50/50"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? "bg-emerald-600 text-white"
                                    : "border border-slate-300 text-transparent"
                                }`}
                              >
                                <Check className="w-2.5 h-2.5" />
                              </div>
                              <span className="font-bold text-xs">
                                Fiscal Year {summary.fiscalYear}
                              </span>
                              {summary.fiscalYear === currentActiveYear && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                                  Current
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono text-[11px] text-slate-500">
                                {summary.openCount} Open / {summary.closedCount} Closed
                              </span>
                              {getStatusBadge(summary.status, "sm")}
                            </div>
                          </li>
                        );
                      })
                    )}
                  </ul>

                  {/* Footer with total count */}
                  <div className="p-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between items-center px-3">
                    <span>
                      {fiscalYearSummaries.length} fiscal year{fiscalYearSummaries.length === 1 ? "" : "s"} configured
                    </span>
                    <span className="text-slate-400 font-mono">Use ↑↓ and Enter</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick-Access Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden lg:inline">
                Quick Jump:
              </span>
              {quickAccessYears.map((yr) => {
                const isSelected = selectedScheduleYear === yr;
                const isCurrent = yr === currentActiveYear;
                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setSelectedScheduleYear(yr)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                      isSelected
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
                    }`}
                  >
                    {isCurrent ? `★ FY ${yr}` : `FY ${yr}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Year Summary Banner & Action Controls */}
          {activeSelectedSummary && (
            <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200/60">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100/70 text-emerald-800 flex items-center justify-center font-extrabold text-xs">
                    {String(activeSelectedSummary.fiscalYear).slice(-2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">
                        Fiscal Year {activeSelectedSummary.fiscalYear} Cutoff Schedule
                      </h4>
                      {getStatusBadge(activeSelectedSummary.status, "md")}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      24 Semi-Monthly Cutoffs:{" "}
                      <span className="font-bold text-emerald-700">
                        {activeSelectedSummary.openCount} Open
                      </span>{" "}
                      ·{" "}
                      <span className="font-bold text-slate-600">
                        {activeSelectedSummary.closedCount} Closed
                      </span>
                    </p>
                  </div>
                </div>

                {/* Batch Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {activeSelectedSummary.openCount > 0 && (
                    <button
                      type="button"
                      disabled={finalizeAllMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Lock and finalize ALL ${activeSelectedSummary.openCount} remaining open cutoff periods for FY ${activeSelectedSummary.fiscalYear}? Contributions for this year will no longer be editable.`
                          )
                        ) {
                          finalizeAllMutation.mutate(activeSelectedSummary.fiscalYear);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-800 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      title="Lock and finalize all cutoff periods in this fiscal year"
                    >
                      <Lock className="w-3.5 h-3.5 text-rose-600" />
                      {finalizeAllMutation.isPending ? "Locking..." : "Lock All Periods"}
                    </button>
                  )}

                  {activeSelectedSummary.closedCount > 0 && (
                    <button
                      type="button"
                      disabled={reopenAllMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Reopen all ${activeSelectedSummary.closedCount} closed cutoff periods for FY ${activeSelectedSummary.fiscalYear}?`
                          )
                        ) {
                          reopenAllMutation.mutate(activeSelectedSummary.fiscalYear);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      title="Reopen all cutoff periods in this fiscal year"
                    >
                      <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                      {reopenAllMutation.isPending ? "Reopening..." : "Reopen All Periods"}
                    </button>
                  )}
                </div>
              </div>

              {/* 4. Cutoff Periods Grid (24 semi-monthly periods) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                {activeSelectedSummary.cutoffs.map((cutoff, idx) => {
                  const shortDate = new Date(cutoff.cutoffDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });

                  return (
                    <div
                      key={cutoff.id}
                      className={`p-2.5 rounded-xl border text-xs flex flex-col justify-between transition-all ${
                        cutoff.isClosed
                          ? "bg-slate-100/80 border-slate-200 text-slate-500"
                          : "bg-white border-emerald-200/90 text-slate-800 shadow-2xs hover:border-emerald-300"
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 mb-1">
                        <span>C{String(idx + 1).padStart(2, "0")}</span>
                        <button
                          type="button"
                          onClick={() =>
                            toggleCutoffMutation.mutate({
                              id: cutoff.id,
                              isClosed: cutoff.isClosed,
                            })
                          }
                          disabled={toggleCutoffMutation.isPending}
                          className="hover:scale-110 active:scale-95 transition-transform p-0.5 rounded cursor-pointer"
                          title={
                            cutoff.isClosed
                              ? "Click to Reopen this cutoff period"
                              : "Click to Lock and Finalize this cutoff period"
                          }
                        >
                          {cutoff.isClosed ? (
                            <Lock className="w-3 h-3 text-rose-500 hover:text-rose-600" />
                          ) : (
                            <Unlock className="w-3 h-3 text-emerald-600 hover:text-emerald-700" />
                          )}
                        </button>
                      </div>

                      <div className="font-mono font-bold text-xs text-slate-900">
                        {cutoff.label}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{shortDate}</div>

                      <div className="mt-2 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <span
                          className={`font-semibold ${
                            cutoff.isClosed ? "text-rose-600" : "text-emerald-700"
                          }`}
                        >
                          {cutoff.isClosed ? "Locked" : "Open"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
