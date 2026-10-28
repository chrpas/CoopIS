import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Contribution } from "../../types";
import { Wallet, Calendar, CreditCard } from "lucide-react";

export const ContributionsPage: React.FC = () => {
  const { data: contributions = [], isLoading } = useQuery<Contribution[]>({
    queryKey: ["contributions"],
    queryFn: async () => {
      const res = await api.get<Contribution[]>("/contributions");
      return res.data;
    },
  });

  const totalCollected = contributions.reduce((acc, c) => acc + Number(c.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Member Contributions & Capital Build-up
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              Admin Only
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Semi-monthly payroll deductions and share capital ledger.
          </p>
        </div>

        <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl flex items-center gap-3 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Total Recorded Capital
            </div>
            <div className="text-base font-extrabold text-slate-900">
              ₱{totalCollected.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading contributions...</div>
        ) : contributions.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">No contribution records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Cutoff Period</th>
                  <th className="py-3 px-4 text-right">Amount (₱)</th>
                  <th className="py-3 px-4">Payment Channel</th>
                  <th className="py-3 px-4 text-right">Recorded Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contributions.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{c.memberName}</div>
                      <div className="text-xs text-slate-400">{c.memberCode}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-800">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {c.cutoffLabel}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-emerald-700">
                      ₱{Number(c.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                        <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                        {c.paymentChannel.replace("_", " ")}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right text-xs text-slate-500">
                      {new Date(c.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
