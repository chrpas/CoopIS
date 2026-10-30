import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
} from "@tanstack/react-table";
import { memberService } from "../../services/memberService";
import { Member, MemberStatus } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { MemberModalForm } from "./MemberModalForm";
import { MemberDetailsDrawer } from "./MemberDetailsDrawer";
import { MemberDeleteDialog } from "./MemberDeleteDialog";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Ban,
  Shield,
  Eye,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Mail,
  Phone,
  Calendar,
  HandCoins,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";

export const MembersPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";

  // Filter & Pagination States
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<MemberStatus | "">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<string>("lastName");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Modal / Drawer States
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<Member | null>(null);
  const [selectedMemberIdForDrawer, setSelectedMemberIdForDrawer] = useState<string | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);

  // Fetch paginated member directory
  const { data: pagedData, isLoading } = useQuery({
    queryKey: ["members", { page, pageSize, search: searchInput, status: statusFilter, sortBy, sortOrder }],
    queryFn: () =>
      memberService.getMembers({
        page,
        pageSize,
        search: searchInput,
        status: statusFilter,
        sortBy,
        sortOrder,
      }),
  });

  const members = pagedData?.items || [];
  const totalCount = pagedData?.totalCount || 0;
  const totalPages = pagedData?.totalPages || 0;

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const formatCurrency = (val?: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Define TanStack Table Columns
  const columns = useMemo<ColumnDef<Member>[]>(
    () => [
      {
        accessorKey: "memberCode",
        header: () => (
          <button
            onClick={() => handleSort("memberCode")}
            className="flex items-center gap-1.5 font-semibold text-slate-700 hover:text-slate-900 transition-colors"
          >
            Member Code
            {sortBy === "memberCode" ? (
              sortOrder === "asc" ? (
                <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
              )
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center flex-shrink-0">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <button
              onClick={() => setSelectedMemberIdForDrawer(row.original.id)}
              className="font-mono font-bold text-slate-900 hover:text-emerald-700 hover:underline transition-colors text-xs"
            >
              {row.original.memberCode}
            </button>
          </div>
        ),
      },
      {
        accessorKey: "lastName",
        header: () => (
          <button
            onClick={() => handleSort("lastName")}
            className="flex items-center gap-1.5 font-semibold text-slate-700 hover:text-slate-900 transition-colors"
          >
            Full Name
            {sortBy === "lastName" ? (
              sortOrder === "asc" ? (
                <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
              )
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
              {row.original.firstName[0]}
              {row.original.lastName[0]}
            </div>
            <div>
              <button
                onClick={() => setSelectedMemberIdForDrawer(row.original.id)}
                className="font-semibold text-slate-900 hover:text-emerald-700 text-left transition-colors"
              >
                {row.original.lastName}, {row.original.firstName}
              </button>
              <div className="text-[11px] text-slate-400 sm:hidden">{row.original.email}</div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "email",
        header: () => (
          <button
            onClick={() => handleSort("email")}
            className="flex items-center gap-1.5 font-semibold text-slate-700 hover:text-slate-900 transition-colors"
          >
            Contact Information
            {sortBy === "email" ? (
              sortOrder === "asc" ? (
                <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
              )
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5 text-xs">
            <span className="flex items-center gap-1.5 text-slate-700 font-medium">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              {row.original.email}
            </span>
            {row.original.phone && (
              <span className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                <Phone className="w-3 h-3 text-slate-400" />
                {row.original.phone}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: () => (
          <button
            onClick={() => handleSort("status")}
            className="flex items-center gap-1.5 font-semibold text-slate-700 hover:text-slate-900 transition-colors"
          >
            Status
            {sortBy === "status" ? (
              sortOrder === "asc" ? (
                <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
              )
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const status = row.original.status;
          switch (status) {
            case "ACTIVE":
              return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Active
                </span>
              );
            case "INACTIVE":
              return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                  <Clock className="w-3 h-3 text-amber-600" />
                  Inactive
                </span>
              );
            case "SUSPENDED":
              return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                  <Ban className="w-3 h-3 text-rose-600" />
                  Suspended
                </span>
              );
          }
        },
      },
      {
        accessorKey: "totalContributions",
        header: () => <span className="text-right block">Share Capital</span>,
        cell: ({ row }) => (
          <div className="text-right">
            <span className="font-bold text-slate-900 text-xs">
              {formatCurrency(row.original.totalContributions)}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "activeLoansCount",
        header: () => <span className="text-center block">Active Loans</span>,
        cell: ({ row }) => {
          const count = row.original.activeLoansCount || 0;
          return (
            <div className="text-center">
              {count > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                  <HandCoins className="w-3 h-3 text-sky-600" />
                  {count} Active
                </span>
              ) : (
                <span className="text-xs text-slate-400">None</span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: () => (
          <button
            onClick={() => handleSort("createdAt")}
            className="flex items-center gap-1.5 font-semibold text-slate-700 hover:text-slate-900 transition-colors"
          >
            Joined
            {sortBy === "createdAt" ? (
              sortOrder === "asc" ? (
                <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
              )
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-1 text-slate-600 text-xs">
            <Calendar className="w-3 h-3 text-slate-400" />
            {formatDate(row.original.createdAt)}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <span className="text-right block">Actions</span>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => setSelectedMemberIdForDrawer(row.original.id)}
              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
              title="View member statement and history"
            >
              <Eye className="w-4 h-4" />
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => setMemberToEdit(row.original)}
                  className="p-1.5 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors"
                  title="Edit member profile"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setMemberToDelete(row.original)}
                  className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Suspend or remove member"
                >
                  <Ban className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        ),
      },
    ],
    [sortBy, sortOrder, isAdmin]
  );

  const table = useReactTable({
    data: members,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Member Registry</h2>
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                isAdmin
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              {isAdmin ? "Admin: Full CRUD Access" : "User: Read-Only Directory"}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            General assembly directory, share capital standing, member code registry, and loan eligibility.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin ? (
            <button
              onClick={() => {
                setMemberToEdit(null);
                setIsEnrollModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm hover:shadow-md transition-all flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Enroll New Member</span>
            </button>
          ) : (
            <div className="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              Read-Only Access
            </div>
          )}
        </div>
      </div>

      {/* Control Bar: Search & Status Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, member code (MEM-...), or email..."
            className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput("");
                setPage(1);
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" />
            Status:
          </span>
          {(
            [
              { label: "All", value: "" },
              { label: "Active", value: "ACTIVE" },
              { label: "Inactive", value: "INACTIVE" },
              { label: "Suspended", value: "SUSPENDED" },
            ] as const
          ).map((item) => {
            const isSelected = statusFilter === item.value;
            return (
              <button
                key={item.label}
                onClick={() => {
                  setStatusFilter(item.value);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isSelected
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* TanStack Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-sm text-slate-500 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading cooperative member directory...</span>
          </div>
        ) : members.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900">No Members Found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchInput || statusFilter
                ? "No member matches the specified filters or search keyword. Try clearing filters."
                : "No members enrolled yet. Use the Enroll button above to register members."}
            </p>
            {(searchInput || statusFilter) && (
              <button
                onClick={() => {
                  setSearchInput("");
                  setStatusFilter("");
                  setPage(1);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/90 text-xs font-semibold text-slate-600 border-b border-slate-200">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="py-3.5 px-4 font-semibold">
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
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    onClick={(e) => {
                      // Prevent opening drawer if user clicked action buttons
                      if ((e.target as HTMLElement).closest("button")) return;
                      setSelectedMemberIdForDrawer(row.original.id);
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="py-3.5 px-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>
              Showing{" "}
              <strong className="text-slate-900">
                {totalCount === 0 ? 0 : (page - 1) * pageSize + 1}
              </strong>{" "}
              to{" "}
              <strong className="text-slate-900">
                {Math.min(page * pageSize, totalCount)}
              </strong>{" "}
              of <strong className="text-slate-900">{totalCount}</strong> members
            </span>

            <span className="text-slate-300">|</span>

            <div className="flex items-center gap-1.5">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 focus:border-emerald-600 focus:outline-hidden"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span>per page</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 font-semibold text-slate-800">
              Page {page} of {Math.max(1, totalPages)}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal 1: Add New Member Form */}
      <MemberModalForm
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        onSuccess={(newMember) => {
          setSelectedMemberIdForDrawer(newMember.id);
        }}
      />

      {/* Modal 2: Edit Member Form */}
      <MemberModalForm
        isOpen={Boolean(memberToEdit)}
        memberToEdit={memberToEdit}
        onClose={() => setMemberToEdit(null)}
      />

      {/* Drawer: Member Details & Ledger */}
      <MemberDetailsDrawer
        memberId={selectedMemberIdForDrawer}
        isOpen={Boolean(selectedMemberIdForDrawer)}
        onClose={() => setSelectedMemberIdForDrawer(null)}
        onEdit={(member) => {
          setMemberToEdit(member as Member);
        }}
        onRequestDelete={(member) => {
          setMemberToDelete(member as Member);
        }}
      />

      {/* Dialog: Delete / Suspend confirmation */}
      <MemberDeleteDialog
        member={memberToDelete}
        isOpen={Boolean(memberToDelete)}
        onClose={() => setMemberToDelete(null)}
      />
    </div>
  );
};
