import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { SurplusDistribution } from "../../types";
import { PieChart, ShieldCheck, CheckCircle } from "lucide-react";

export const DistributionPage: React.FC = () => {
  const { data: distributions = [], isLoading } = useQuery<SurplusDistribution[]>({
    queryKey: ["distributions"],
    queryFn: async () => {
      const res = await api.get<SurplusDistribution[]>("/distribution");
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Surplus & Patronage Distribution
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              Admin Only
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Statutory net surplus partitioning: 65% Dividend, 30% Patronage Refund, 5% Management Reserve.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-sm text-slate-500">Loading surplus distribution...</div>
      ) : distributions.length === 0 ? (
        <div className="p-12 text-center text-sm text-slate-500">No surplus distribution periods found.</div>
      ) : (
        distributions.map((d) => (
          <div key={d.id} className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <PieChart className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Fiscal Year {d.fiscalYear} Net Surplus Pool
                    </h3>
                    <p className="text-xs text-slate-500">
                      Total Interest Revenue:{" "}
                      <span className="font-bold text-slate-900">
                        ₱{Number(d.totalInterestIncome).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                      d.isFinalized
                        ? "bg-slate-100 text-slate-700"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    {d.isFinalized ? "Finalized & Credited" : "Draft / Open Cycle"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-5">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2">
                    <span>Dividend Pool (65%)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900">
                      Cap Build-up
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-950">
                    ₱{Number(d.dividendPool).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-[11px] text-emerald-700 mt-2">
                    Pro-rata dividend credited directly to each member’s capital ledger.
                  </p>
                </div>

                <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-5">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">
                    <span>Patronage Pool (30%)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-200 text-blue-900">
                      Loan Utilization
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-blue-950">
                    ₱{Number(d.patronagePool).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-[11px] text-blue-700 mt-2">
                    Pro-rata patronage returned to borrowers proportional to loan interest paid.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    <span>Management Pool (5%)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                      Reserves
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900">
                    ₱{Number(d.managementPool).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Statutory reserve fund and community development allocations.
                  </p>
                </div>
              </div>
            </div>

            {d.memberLedgers && d.memberLedgers.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Member Surplus Ledgers (Computed Allocations)
                  </h4>
                  <span className="text-xs text-slate-500">
                    {d.memberLedgers.length} credited accounts
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Member Name</th>
                        <th className="py-3 px-4 text-right">Contribution Capital</th>
                        <th className="py-3 px-4 text-right">Dividend Earned</th>
                        <th className="py-3 px-4 text-right">Borrowings</th>
                        <th className="py-3 px-4 text-right">Patronage Earned</th>
                        <th className="py-3 px-4 text-right">Net Credited Savings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {d.memberLedgers.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {l.member ? `${l.member.firstName} ${l.member.lastName}` : "Member Ledger"}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-700">
                            ₱{Number(l.totalContribution).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-700">
                            ₱{Number(l.dividendEarned).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-700">
                            ₱{Number(l.totalLoansBorrowed).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-blue-700">
                            ₱{Number(l.patronageEarned).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right font-extrabold text-emerald-800">
                            ₱{Number(l.netSavingsCredited).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};
