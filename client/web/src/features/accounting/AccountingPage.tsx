import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { BankReconciliation } from "../../types";
import { CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";

export const AccountingPage: React.FC = () => {
  const { data: records = [], isLoading } = useQuery<BankReconciliation[]>({
    queryKey: ["reconciliations"],
    queryFn: async () => {
      const res = await api.get<BankReconciliation[]>("/accounting/reconciliations");
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Bank Reconciliation & Audit
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              Admin Only
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Reconcile depository cash balances, withholding taxes, gross bank interest, and variances.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading audit records...</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">No bank reconciliation records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Statement Date</th>
                  <th className="py-3 px-4">Fiscal Cutoff</th>
                  <th className="py-3 px-4 text-right">Cash In Bank</th>
                  <th className="py-3 px-4 text-right">Gross Interest</th>
                  <th className="py-3 px-4 text-right">Tax (20%)</th>
                  <th className="py-3 px-4 text-right">Net Interest</th>
                  <th className="py-3 px-4 text-center">Variance Audit</th>
                  <th className="py-3 px-4">Audit Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => {
                  const isZeroVariance = Number(r.reconciledVariance) === 0;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <FileSpreadsheet className="w-4 h-4 text-slate-400" />
                          {new Date(r.statementDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {r.cutoffLabel || "Unassigned"}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        ₱{Number(r.cashInBank).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right text-indigo-700 font-medium">
                        ₱{Number(r.bankGrossInterest).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right text-rose-600 font-medium">
                        ₱{Number(r.withholdingTax).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right text-emerald-700 font-bold">
                        ₱{Number(r.netBankInterest).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isZeroVariance ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ₱0.00 (Balanced)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            Variance: ₱{Number(r.reconciledVariance).toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 max-w-xs truncate">
                        {r.notes || "Reconciled with depository bank"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
