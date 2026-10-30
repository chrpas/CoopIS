import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Member, Loan } from "../../types";
import { Users, HandCoins, Wallet, Scale, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

export const DashboardPage: React.FC = () => {
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["members"],
    queryFn: async () => {
      const res = await api.get<any>("/members?pageSize=100");
      return Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
    },
  });

  const { data: loans = [] } = useQuery<Loan[]>({
    queryKey: ["loans"],
    queryFn: async () => {
      const res = await api.get<Loan[]>("/loans");
      return res.data;
    },
  });

  const activeMembers = members.filter((m) => m.status === "ACTIVE").length;
  const totalLoanPrincipal = loans.reduce((acc, l) => acc + Number(l.principalAmount || 0), 0);
  const totalInterestEarned = loans.reduce((acc, l) => acc + Number(l.interestEarned || 0), 0);
  const totalRepayments = loans.reduce((acc, l) => acc + Number(l.totalRepayments || 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Dashboard</h2>
        <p className="text-sm text-slate-500 mt-1">
          Fiscal Year 2026 Overview, Member Capital Build-up, and Loan Portfolio Analytics
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Members
            </span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{activeMembers}</span>
            <span className="text-xs text-emerald-600 font-medium">/{members.length} registered</span>
          </div>
          <div className="mt-3 text-xs text-slate-500">100% good standing status</div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Loan Portfolio
            </span>
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <HandCoins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              ₱{totalLoanPrincipal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500">{loans.length} active and issued loans</div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Interest Earned
            </span>
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              ₱{totalInterestEarned.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-3 text-xs text-indigo-600 font-medium">Feed into surplus pool</div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Collected Repayments
            </span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              ₱{totalRepayments.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-3 text-xs text-emerald-600 font-medium">Payroll deduction cutoffs</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-6">
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
                {loans.slice(0, 5).map((loan) => (
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

        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col justify-between">
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
