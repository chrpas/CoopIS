import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memberService } from "../../services/memberService";
import { Member, MemberDetail } from "../../types";
import { useToast } from "../../components/ui/Toast";
import { AlertTriangle, Ban, X, Loader2, ShieldAlert } from "lucide-react";

interface MemberDeleteDialogProps {
  member: Member | MemberDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const MemberDeleteDialog: React.FC<MemberDeleteDialogProps> = ({
  member,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!member) throw new Error("No member selected");
      return await memberService.deleteOrSuspendMember(member.id);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["members-lookup"] });
      queryClient.invalidateQueries({ queryKey: ["member-detail", member?.id] });
      showToast(
        "info",
        "Member Processed",
        data.message || `Member ${member?.memberCode} has been suspended/removed.`
      );
      setErrorMsg(null);
      onSuccess?.();
      onClose();
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Action failed. Member cannot be removed while active obligations exist.";
      setErrorMsg(msg);
      showToast("error", "Action Restricted", msg);
    },
  });

  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
      >
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <button
              onClick={() => {
                setErrorMsg(null);
                onClose();
              }}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4">
            <h3 id="delete-dialog-title" className="text-lg font-bold text-slate-900">
              Suspend / Remove Member?
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              You are processing member{" "}
              <strong className="text-slate-900">
                {member.firstName} {member.lastName}
              </strong>{" "}
              (<span className="font-mono text-emerald-700 font-semibold">{member.memberCode}</span>).
            </p>

            <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Cooperative Audit Rules:
              </div>
              <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5">
                <li>If share contributions or history exist, member will be safely <strong>SUSPENDED</strong>.</li>
                <li>Action will be <strong>strictly restricted</strong> if any loans are active or unpaid.</li>
              </ul>
            </div>

            {errorMsg && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {errorMsg}
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                onClose();
              }}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Ban className="w-3.5 h-3.5" />
                  Confirm Suspend / Remove
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
