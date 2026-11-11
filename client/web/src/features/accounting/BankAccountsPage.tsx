import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Landmark,
  Plus,
  Scale,
  ShieldCheck,
  RefreshCw,
  Wallet,
  AlertCircle,
  Building2,
  Trash2,
  X,
  Lock,
} from "lucide-react";
import { api } from "../../services/api";
import { BankAccount, LiquiditySummary, CreateBankAccountPayload, AdjustBankBalancePayload } from "../../types";
import { useToast } from "../../components/ui/Toast";

export const BankAccountsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAccountForReconcile, setSelectedAccountForReconcile] = useState<BankAccount | null>(null);

  // Form states for Add Bank Account
  const [addBankName, setAddBankName] = useState("");
  const [addAccountNumber, setAddAccountNumber] = useState("");
  const [addAccountName, setAddAccountName] = useState("");
  const [addInitialBalance, setAddInitialBalance] = useState("0");
  const [addIsPrimary, setAddIsPrimary] = useState(false);

  // Form states for Reconcile Balance
  const [reconcileNewBalance, setReconcileNewBalance] = useState("");
  const [reconcileReason, setReconcileReason] = useState("");
  const [reconcileMarkUpdated, setReconcileMarkUpdated] = useState(true);

  // 1. Fetch Bank Accounts (Admin only)
  const { data: accounts = [], isLoading: isLoadingAccounts } = useQuery<BankAccount[]>({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const res = await api.get<BankAccount[]>("/bank-accounts");
      return res.data;
    },
  });

  // 2. Fetch Liquidity Summary
  const { data: liquidity } = useQuery<LiquiditySummary>({
    queryKey: ["bank-liquidity"],
    queryFn: async () => {
      const res = await api.get<LiquiditySummary>("/bank-accounts/liquidity");
      return res.data;
    },
  });

  // 3. Create Bank Account Mutation
  const createAccountMutation = useMutation({
    mutationFn: async (payload: CreateBankAccountPayload) => {
      const res = await api.post<BankAccount>("/bank-accounts", payload);
      return res.data;
    },
    onSuccess: (data) => {
      showToast("success", "Bank Account Added", `Account '${data.bankName}' (${data.accountNumber}) registered.`);
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bank-liquidity"] });
      setIsAddModalOpen(false);
      resetAddForm();
    },
    onError: (err: any) => {
      showToast("error", "Failed to Add Account", err.response?.data?.message || err.message);
    },
  });

  // 4. Adjust / Reconcile Balance Mutation
  const adjustBalanceMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: AdjustBankBalancePayload }) => {
      const res = await api.put<BankAccount>(`/bank-accounts/${id}/balance`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      showToast("success", "Balance Reconciled", `Account '${data.bankName}' balance updated to ₱${data.currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}.`);
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bank-liquidity"] });
      setSelectedAccountForReconcile(null);
    },
    onError: (err: any) => {
      showToast("error", "Reconciliation Error", err.response?.data?.message || err.message);
    },
  });

  // 5. Delete Account Mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/bank-accounts/${id}`);
    },
    onSuccess: () => {
      showToast("success", "Account Removed", "Bank account record deleted.");
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bank-liquidity"] });
    },
    onError: (err: any) => {
      showToast("error", "Delete Failed", err.response?.data?.message || err.message);
    },
  });

  const resetAddForm = () => {
    setAddBankName("");
    setAddAccountNumber("");
    setAddAccountName("");
    setAddInitialBalance("0");
    setAddIsPrimary(false);
  };

  const handleOpenReconcile = (account: BankAccount) => {
    setSelectedAccountForReconcile(account);
    setReconcileNewBalance(String(account.currentBalance));
    setReconcileReason("Periodic Monthly Bank Statement Reconciliation");
    setReconcileMarkUpdated(true);
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto animation-fade-in pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Bank Account Management
            </h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-2xs">
              <Lock className="w-2.5 h-2.5 text-emerald-400" /> Admin Restricted
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Registered cooperative banking reserves, liquidity safeguarding (20% reserve cushion), and balance reconciliations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            resetAddForm();
            setIsAddModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Bank Account
        </button>
      </div>

      {/* Liquidity Safeguard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Bank Balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
            <span>Total Bank Balance</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-3">
            ₱{(liquidity?.totalBankBalance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Across {liquidity?.activeBankAccountsCount ?? 0} institutional accounts
          </p>
        </div>

        {/* 20% Reserve Cushion */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
            <span>20% Reserve Cushion</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 font-mono mt-3">
            ₱{(liquidity?.reserveCushionAmount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Mandatory liquidity buffer locked for emergency reserves
          </p>
        </div>

        {/* Available for Lending */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-800">
            <span>Available for Lending</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono mt-3">
            ₱{(liquidity?.availableLiquidCash ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-emerald-800/80 mt-1">
            Primary bank balance less reserve cushion
          </p>
        </div>

        {/* Unallocated Cash After Queue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
            <span>Net Unallocated Cash</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-3">
            ₱{(liquidity?.netUnallocatedCash ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Pending queue demands: ₱{(liquidity?.queuedLoanDemands ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Bank Accounts Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Registered Bank Accounts
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {accounts.length} active account{accounts.length === 1 ? "" : "s"}
          </span>
        </div>

        {isLoadingAccounts ? (
          <div className="py-16 text-center text-xs text-slate-400">
            Loading bank accounts...
          </div>
        ) : accounts.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-600">No bank accounts registered yet.</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Register the cooperative&apos;s primary depository bank to start tracking liquid lending reserves.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Bank & Primary Status</th>
                  <th className="py-3 px-4">Account Number</th>
                  <th className="py-3 px-4">Account Name</th>
                  <th className="py-3 px-4 text-right">Reconciled Balance</th>
                  <th className="py-3 px-4 text-center">Last Updated</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span>{acc.bankName}</span>
                        {acc.isPrimary && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            ★ Primary Operational
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                      {acc.accountNumber}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {acc.accountName}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 text-sm">
                      ₱{acc.currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-500 text-[11px]">
                      {acc.lastReconciledAt ? (
                        new Date(acc.lastReconciledAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      ) : (
                        <span className="text-slate-400">Not Reconciled</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleOpenReconcile(acc)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        title="Reconcile or adjust balance"
                      >
                        <RefreshCw className="w-3 h-3 text-slate-600" />
                        Reconcile Balance
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete bank account '${acc.bankName}' (${acc.accountNumber})?`)) {
                            deleteAccountMutation.mutate(acc.id);
                          }
                        }}
                        disabled={deleteAccountMutation.isPending}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors rounded-lg cursor-pointer"
                        title="Delete account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Bank Account Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Register Bank Account</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const bal = parseFloat(addInitialBalance) || 0;
                createAccountMutation.mutate({
                  bankName: addBankName,
                  accountNumber: addAccountNumber,
                  accountName: addAccountName,
                  initialBalance: bal,
                  isPrimary: addIsPrimary,
                });
              }}
              className="p-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Bank Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Land Bank of the Philippines, BDO, BPI"
                  value={addBankName}
                  onChange={(e) => setAddBankName(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Account Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1421-0892-34"
                  value={addAccountNumber}
                  onChange={(e) => setAddAccountNumber(e.target.value)}
                  className="w-full text-xs font-mono font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Account Holder / Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. CoopIS Operational Reserve"
                  value={addAccountName}
                  onChange={(e) => setAddAccountName(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Initial Reconciled Balance (PHP)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={addInitialBalance}
                  onChange={(e) => setAddInitialBalance(e.target.value)}
                  className="w-full text-xs font-mono font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="primary-checkbox"
                  type="checkbox"
                  checked={addIsPrimary}
                  onChange={(e) => setAddIsPrimary(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                />
                <label htmlFor="primary-checkbox" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Set as Primary Operational Lending Account
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createAccountMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {createAccountMutation.isPending ? "Registering..." : "Register Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reconcile Balance Modal */}
      {selectedAccountForReconcile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Reconcile Bank Balance</h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedAccountForReconcile.bankName} · {selectedAccountForReconcile.accountNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAccountForReconcile(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const bal = parseFloat(reconcileNewBalance);
                if (isNaN(bal) || bal < 0) {
                  showToast("error", "Invalid Balance", "Please enter a non-negative balance.");
                  return;
                }
                adjustBalanceMutation.mutate({
                  id: selectedAccountForReconcile.id,
                  payload: {
                    newBalance: bal,
                    reason: reconcileReason,
                    markReconciled: reconcileMarkUpdated,
                  },
                });
              }}
              className="p-5 space-y-4"
            >
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
                <span className="text-slate-500">Current Logged Balance:</span>
                <span className="font-mono font-bold text-slate-900">
                  ₱{selectedAccountForReconcile.currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  New Verified Bank Balance (PHP) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={reconcileNewBalance}
                  onChange={(e) => setReconcileNewBalance(e.target.value)}
                  className="w-full text-sm font-mono font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-emerald-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reason / Audit Trail Note
                </label>
                <textarea
                  rows={2}
                  value={reconcileReason}
                  onChange={(e) => setReconcileReason(e.target.value)}
                  placeholder="e.g. Bank statement verification as of cutoff date"
                  className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="mark-reconciled-checkbox"
                  type="checkbox"
                  checked={reconcileMarkUpdated}
                  onChange={(e) => setReconcileMarkUpdated(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                />
                <label htmlFor="mark-reconciled-checkbox" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Update last reconciliation timestamp to now
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAccountForReconcile(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustBalanceMutation.isPending}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {adjustBalanceMutation.isPending ? "Updating..." : "Commit Reconciled Balance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
