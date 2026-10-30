import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { memberService } from "../../services/memberService";
import { Member } from "../../types";
import { useToast } from "../../components/ui/Toast";
import {
  X,
  User,
  Mail,
  Phone,
  Shield,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react";

const memberFormSchema = z.object({
  memberCode: z
    .string()
    .trim()
    .max(50, "Member code cannot exceed 50 characters")
    .optional(),
  firstName: z
    .string()
    .trim()
    .min(2, "First name must be at least 2 characters")
    .max(100, "First name cannot exceed 100 characters"),
  lastName: z
    .string()
    .trim()
    .min(2, "Last name must be at least 2 characters")
    .max(100, "Last name cannot exceed 100 characters"),
  email: z
    .string()
    .trim()
    .min(1, "Email address is required")
    .email("Please enter a valid email address"),
  phone: z
    .string()
    .trim()
    .max(25, "Phone number cannot exceed 25 characters")
    .optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"] as const),
});

type MemberFormValues = z.infer<typeof memberFormSchema>;

interface MemberModalFormProps {
  isOpen: boolean;
  onClose: () => void;
  memberToEdit?: Member | null;
  onSuccess?: (member: Member) => void;
}

export const MemberModalForm: React.FC<MemberModalFormProps> = ({
  isOpen,
  onClose,
  memberToEdit,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEditing = Boolean(memberToEdit);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: {
      memberCode: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      status: "ACTIVE",
    },
  });

  useEffect(() => {
    if (memberToEdit) {
      reset({
        memberCode: memberToEdit.memberCode,
        firstName: memberToEdit.firstName,
        lastName: memberToEdit.lastName,
        email: memberToEdit.email,
        phone: memberToEdit.phone || "",
        status: memberToEdit.status,
      });
    } else {
      reset({
        memberCode: "",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        status: "ACTIVE",
      });
    }
    setServerError(null);
  }, [memberToEdit, reset, isOpen]);

  const createMutation = useMutation({
    mutationFn: (values: MemberFormValues) =>
      memberService.createMember({
        memberCode: values.memberCode ? values.memberCode.trim() : undefined,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        phone: values.phone?.trim() || null,
        status: values.status,
      }),
    onSuccess: (newMember) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["members-lookup"] });
      showToast(
        "success",
        "Member Registered",
        `Successfully enrolled ${newMember.firstName} ${newMember.lastName} (${newMember.memberCode})`
      );
      onSuccess?.(newMember);
      onClose();
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Failed to register member. Please check input values.";
      setServerError(msg);
      showToast("error", "Registration Failed", msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: MemberFormValues) => {
      if (!memberToEdit) throw new Error("No member selected for editing");
      return memberService.updateMember(memberToEdit.id, {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        phone: values.phone?.trim() || null,
        status: values.status,
      });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["members-lookup"] });
      queryClient.invalidateQueries({ queryKey: ["member-detail", updated.id] });
      showToast(
        "success",
        "Profile Updated",
        `Updated member record for ${updated.firstName} ${updated.lastName}`
      );
      onSuccess?.(updated);
      onClose();
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Failed to update member profile.";
      setServerError(msg);
      showToast("error", "Update Failed", msg);
    },
  });

  const onSubmit = async (values: MemberFormValues) => {
    setServerError(null);
    if (isEditing) {
      await updateMutation.mutateAsync(values);
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-modal-title"
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              {isEditing ? <User className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div>
              <h3 id="member-modal-title" className="text-lg font-bold text-white tracking-tight">
                {isEditing ? "Edit Member Profile" : "Enroll New Member"}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                {isEditing
                  ? `Updating profile for ${memberToEdit?.memberCode}`
                  : "Register a shareholder to the cooperative general registry"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 overflow-y-auto space-y-5">
          {serverError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{serverError}</div>
            </div>
          )}

          {/* Member Code */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Member Code {isEditing ? "(Permanent)" : "(Optional)"}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Shield className="w-4 h-4" />
              </div>
              <input
                type="text"
                disabled={isEditing}
                placeholder={isEditing ? memberToEdit?.memberCode : "e.g. Leave blank for auto-generation (MEM-2026-XXX)"}
                {...register("memberCode")}
                className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm font-medium transition-all ${
                  isEditing
                    ? "bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200"
                    : "text-slate-900 border-slate-300 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                } ${errors.memberCode ? "border-rose-400 ring-2 ring-rose-100" : ""}`}
              />
            </div>
            {!isEditing && (
              <p className="text-[11px] text-slate-500 mt-1">
                If left empty, the system generates sequential code like <span className="font-mono text-emerald-700 font-medium">MEM-2026-003</span>.
              </p>
            )}
            {errors.memberCode && (
              <p className="text-xs text-rose-600 mt-1 font-medium">{errors.memberCode.message}</p>
            )}
          </div>

          {/* Names Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                First Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="e.g. Maria"
                  {...register("firstName")}
                  className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm text-slate-900 font-medium transition-all focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 ${
                    errors.firstName ? "border-rose-400 ring-2 ring-rose-100" : "border-slate-300"
                  }`}
                />
              </div>
              {errors.firstName && (
                <p className="text-xs text-rose-600 mt-1 font-medium">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Last Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="e.g. Santos"
                  {...register("lastName")}
                  className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm text-slate-900 font-medium transition-all focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 ${
                    errors.lastName ? "border-rose-400 ring-2 ring-rose-100" : "border-slate-300"
                  }`}
                />
              </div>
              {errors.lastName && (
                <p className="text-xs text-rose-600 mt-1 font-medium">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  placeholder="name@example.com"
                  {...register("email")}
                  className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm text-slate-900 font-medium transition-all focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 ${
                    errors.email ? "border-rose-400 ring-2 ring-rose-100" : "border-slate-300"
                  }`}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-rose-600 mt-1 font-medium">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Contact Phone
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  placeholder="+63 917 123 4567"
                  {...register("phone")}
                  className={`w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm text-slate-900 font-medium transition-all focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 ${
                    errors.phone ? "border-rose-400 ring-2 ring-rose-100" : "border-slate-300"
                  }`}
                />
              </div>
              {errors.phone && (
                <p className="text-xs text-rose-600 mt-1 font-medium">{errors.phone.message}</p>
              )}
            </div>
          </div>

          {/* Membership Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Membership Status
            </label>
            <select
              {...register("status")}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all"
            >
              <option value="ACTIVE">ACTIVE (In Good Standing, Eligible for Loans/Dividends)</option>
              <option value="INACTIVE">INACTIVE (Dormant, No Active Borrowing)</option>
              <option value="SUSPENDED">SUSPENDED (Restricted Account Access)</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Note: Status cannot be set to Inactive or Suspended if the member holds active loans.
            </p>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting || createMutation.isPending || updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isEditing ? "Saving Changes..." : "Enrolling..."}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isEditing ? "Save Changes" : "Confirm Enrollment"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
