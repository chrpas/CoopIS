import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Member, Loan, MemberStatementResponse } from "../../types";
import {
  Users,
  HandCoins,
  Wallet,
  Scale,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
} from "lucide-react";
import { Link } from "react-router-dom";

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const isMember = user?.role === "Member";

  // Admin queries
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["members"],
    queryFn: async () => {
      const res = await api.get<any>("/members?pageSize=100");
      return Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
    },
    enabled: !isMember,
  });

  const { data: adminLoans = [] } = useQuery<Loan[]>({
    queryKey: ["loans"],
    queryFn: async () => {
      const res = await api.get<Loan[]>("/loans");
      return res.data;
    },
    enabled: !isMember,
  });

  // Member-specific queries (calling strictly scoped endpoints)
  const { data: memberStatement } = useQuery<MemberStatementResponse>({
    queryKey: ["my-statement"],
    queryFn: async () => {
      const res = await api.get<MemberStatementResponse>("/contributions/my-statement");
      return res.data;
    },
    enabled: isMember,
  });

  const { data: memberLoans = [] } = useQuery<Loan[]>({
    queryKey: ["my-loans"],
    queryFn: async () => {
      const res = await api.get<Loan[]>("/loans/my-loans");
      return res.data;
    },
    enabled: isMember,
  });

  // Member calculated metrics
  const myTotalShareCapital = Number(
    memberStatement?.totalAccumulated ??
    memberStatement?.totalAccumulatedCapital ??
    0
  );
  const myActiveLoans = memberLoans.filter(
    (l) => l.status === "ACTIVE" || l.status === "APPROVED"
  );
  const myActiveLoanBalance = myActiveLoans.reduce((sum, l) => {
    const paid = Number(l.principalPaid ?? l.totalRepayments ?? 0);
    const balance = Math.max(0, Number(l.principalAmount || 0) - paid);
    return sum + balance;
  }, 0);
  const nextCutoffDue = myActiveLoans.reduce(
    (sum, l) => sum + Number(l.cutoffPaymentAmount || 0),
    0
  );

  const overdueCount =
    memberStatement?.overdueCount ??
    memberStatement?.overdueMissedCutoffsCount ??
    0;
  const hasOverdueInstallment = overdueCount > 0;
  const amortizationStatus =
    myActiveLoans.length === 0
      ? "No Active Borrowings"
      : hasOverdueInstallment
      ? "Action Required / Late"
      : "Good Standing";

  const memberDisplayName =
    memberStatement?.fullName?.trim() ||
    memberStatement?.memberName?.trim() ||
    user?.memberName?.trim() ||
    (user?.username && user.username.toLowerCase() !== "member" ? user.username : "Member");

  if (isMember) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
              Member Self-Service Portal
            </span>
            {(memberStatement?.memberCode || user?.memberCode) && (
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {memberStatement?.memberCode || user?.memberCode}
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Welcome, {memberDisplayName}!
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Personal Share Capital Build-up, Active Loan Amortization, and Compliance Overview
          </p>
        </div>

        {/* Member KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* 1. My Total Share Capital */}
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                My Share Capital
              </span>
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 sm:mt-4 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 truncate">
                ₱{myTotalShareCapital.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="mt-2 sm:mt-3 text-xs text-emerald-600 font-medium">
              {memberStatement?.contributedCount ?? memberStatement?.totalContributedCutoffsCount ?? 0} Cutoffs Remitted
            </div>
          </div>

          {/* 2. My Active Loan Balance */}
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active Loan Balance
              </span>
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <HandCoins className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 sm:mt-4 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 truncate">
                ₱{myActiveLoanBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="mt-2 sm:mt-3 text-xs text-slate-500">
              {myActiveLoans.length} active loan{myActiveLoans.length === 1 ? "" : "s"}
            </div>
          </div>

          {/* 3. Next Cutoff Repayment Due */}
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Next Cutoff Repayment
              </span>
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Scale className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 sm:mt-4 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 truncate">
                ₱{nextCutoffDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="mt-2 sm:mt-3 text-xs text-indigo-600 font-medium">
              Upcoming Payroll Installment
            </div>
          </div>

          {/* 4. Amortization Status */}
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Amortization Status
              </span>
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  hasOverdueInstallment
                    ? "bg-rose-50 text-rose-600"
                    : myActiveLoans.length > 0
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {hasOverdueInstallment ? (
                  <AlertCircle className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </div>
            </div>
            <div className="mt-3 sm:mt-4 flex items-baseline gap-2">
              <span
                className={`text-xl sm:text-2xl font-extrabold truncate ${
                  hasOverdueInstallment
                    ? "text-rose-600"
                    : myActiveLoans.length > 0
                    ? "text-emerald-700"
                    : "text-slate-800"
                }`}
              >
                {amortizationStatus}
              </span>
            </div>
            <div className="mt-2 sm:mt-3 text-xs text-slate-500">
              {hasOverdueInstallment
                ? `${memberStatement?.overdueCount} overdue period(s)`
                : "No overdue amortizations"}
            </div>
          </div>
        </div>

        {/* Member Detailed Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Member Loans Panel (No Disbursals Table) */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">My Loan Accounts</h3>
                <p className="text-xs text-slate-500">
                  Review your active loans and installment repayment history
                </p>
              </div>
              <Link
                to="/loans"
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                View Full Schedules <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {memberLoans.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 rounded-lg">
                <HandCoins className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No loan records on file</p>
                <p className="text-xs text-slate-500 mt-1">
                  You do not currently have any active or past loans with the cooperative.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Reference</th>
                      <th className="py-2.5 px-3">Origination</th>
                      <th className="py-2.5 px-3">Principal</th>
                      <th className="py-2.5 px-3">Cutoff Payment</th>
                      <th className="py-2.5 px-3">Remaining</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {memberLoans.map((loan) => {
                      const paid = Number(loan.principalPaid ?? loan.totalRepayments ?? 0);
                      const remaining = Math.max(0, Number(loan.principalAmount || 0) - paid);
                      return (
                        <tr key={loan.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-3 font-semibold text-slate-900">
                            {loan.loanReference}
                          </td>
                          <td className="py-3 px-3 text-slate-600 text-xs">
                            {new Date(loan.originationDate).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-900">
                            ₱{Number(loan.principalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            ₱{Number(loan.cutoffPaymentAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-3 font-semibold text-emerald-700">
                            ₱{remaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                loan.status === "PAID"
                                  ? "bg-slate-100 text-slate-700"
                                  : loan.status === "ACTIVE"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {loan.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Member Statutory Rights & Quick Links */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Member Rights & Yields</h3>
              <p className="text-xs text-slate-500 mb-5">
                Statutory dividends and patronage distribution entitlement:
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50/60 border border-emerald-100">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-emerald-950">65% Dividend Allocation</div>
                    <div className="text-[11px] text-emerald-800 mt-0.5">
                      Earn dividends proportional to your accumulated ₱{myTotalShareCapital.toLocaleString("en-US", { minimumFractionDigits: 2 })} share capital.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/60 border border-blue-100">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-blue-950">30% Patronage Refund</div>
                    <div className="text-[11px] text-blue-800 mt-0.5">
                      Receive refunds proportional to interest paid across your loans throughout the fiscal year.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <Clock className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Semi-Monthly Payroll Deduction</div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      Fixed deductions on 15th and 30th cutoffs ensure your remittances remain strictly on time.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
              <Link
                to="/contributions"
                className="w-full text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                View 24-Cutoff Contribution Matrix
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Admin Dashboard View
  const activeMembers = members.filter((m) => m.status === "ACTIVE").length;
  const totalLoanPrincipal = adminLoans.reduce((acc, l) => acc + Number(l.principalAmount || 0), 0);
  const totalInterestEarned = adminLoans.reduce((acc, l) => acc + Number(l.interestEarned || 0), 0);
  const totalRepayments = adminLoans.reduce((acc, l) => acc + Number(l.totalRepayments || 0), 0);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Executive Dashboard</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Fiscal Year 2026 Overview, Member Capital Build-up, and Loan Portfolio Analytics
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Members
            </span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{activeMembers}</span>
            <span className="text-xs text-emerald-600 font-medium">/{members.length} registered</span>
          </div>
          <div className="mt-2 sm:mt-3 text-xs text-slate-500">100% good standing status</div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Loan Portfolio
            </span>
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <HandCoins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 truncate">
              ₱{totalLoanPrincipal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-2 sm:mt-3 text-xs text-slate-500">{adminLoans.length} active and issued loans</div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Interest Earned
            </span>
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 truncate">
              ₱{totalInterestEarned.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-2 sm:mt-3 text-xs text-indigo-600 font-medium">Feed into surplus pool</div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Collected Repayments
            </span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 truncate">
              ₱{totalRepayments.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-2 sm:mt-3 text-xs text-emerald-600 font-medium">Payroll deduction cutoffs</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">Recent Loan Disbursals</h3>
              <p className="text-xs text-slate-500">Latest loan operations and amortizations</p>
            </div>
            <Link
              to="/loans"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              View All Loans <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3">Member</th>
                  <th className="py-2.5 px-3">Principal</th>
                  <th className="py-2.5 px-3">Cutoff Payment</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {adminLoans.slice(0, 5).map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-3 font-semibold text-slate-900">{loan.loanReference}</td>
                    <td className="py-3 px-3 text-slate-700">{loan.memberName}</td>
                    <td className="py-3 px-3 font-medium text-slate-900">
                      ₱{Number(loan.principalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      ₱{Number(loan.cutoffPaymentAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                        {loan.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Statutory Distribution Rules</h3>
            <p className="text-xs text-slate-500 mb-5">
              Net interest earnings allocation per Cooperative By-Laws:
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50/60 border border-emerald-100">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-emerald-950">65% Dividend Pool</div>
                  <div className="text-[11px] text-emerald-800 mt-0.5">
                    Distributed pro-rata based on members’ capital build-up & contributions.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/60 border border-blue-100">
                <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-blue-950">30% Patronage Refund</div>
                  <div className="text-[11px] text-blue-800 mt-0.5">
                    Distributed pro-rata based on loan interest paid and active borrowings.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <CheckCircle2 className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-slate-900">5% Management Reserve</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Allocated to operational contingency, audit, and community outreach.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <Link
              to="/distribution"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
            >
              Configure Year-End Distribution <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
