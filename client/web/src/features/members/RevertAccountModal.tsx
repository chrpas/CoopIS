import React, { useState } from "react";
import { X, RotateCcw, AlertTriangle, KeyRound, Loader2 } from "lucide-react";
import { Member } from "../../types";
import { memberService } from "../../services/memberService";

interface RevertAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  onSuccess: (revertedMember: Member) => void;
}

export const RevertAccountModal: React.FC<RevertAccountModalProps> = ({
  isOpen,
  onClose,
  member,
  onSuccess,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !member) return null;

  const handleRevert = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      await memberService.removePortalAccount(member.id);
      onSuccess(member);
      onClose();
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        "Failed to revert portal login account.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Revert Member Portal Login</h3>
              <p className="text-xs text-slate-500">Remove assigned self-service credentials</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />
            <div>
              <div className="font-semibold">Revert Failed</div>
              <div>{error}</div>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-4">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Member:</span>
              <span className="font-bold text-slate-900">
                {member.firstName} {member.lastName}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Member Code:</span>
              <span className="font-mono font-bold text-emerald-700">{member.memberCode}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Registered Email:</span>
              <span className="font-medium text-slate-800">{member.email}</span>
            </div>
            <div className="flex justify-between items-center pt-1.5 border-t border-slate-200">
              <span className="text-slate-500">Assigned Portal Login:</span>
              <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                <KeyRound className="w-3 h-3 text-amber-600" />
                @{member.linkedUsername || "account"}
              </span>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1.5">
            <div className="font-semibold flex items-center gap-1.5 text-amber-950">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              What happens when you revert?
            </div>
            <ul className="list-disc pl-4 space-y-1 text-amber-800 text-[11px] leading-relaxed">
              <li>The login account and temporary credentials for this member will be permanently removed.</li>
              <li>You can then click <strong>Edit Member</strong> to correct the member's email address if needed.</li>
              <li>Then click <strong>Assign Login</strong> to generate new credentials and send the notification email to the corrected address.</li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRevert}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Reverting Login...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Revert Portal Login</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
