import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Member } from "../../types";
import { Mail, Phone, Calendar, CheckCircle, Shield } from "lucide-react";

export const MembersPage: React.FC = () => {
  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: ["members"],
    queryFn: async () => {
      const res = await api.get<Member[]>("/members");
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Member Registry</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              Admin Only
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            General assembly directory, membership codes, and share capital standing.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading members...</div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">No members found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Member Code</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4">Date Joined</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-emerald-600" />
                        {member.memberCode}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {member.firstName} {member.lastName}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex flex-col gap-0.5 text-xs">
                        <span className="flex items-center gap-1.5 text-slate-700">
                          <Mail className="w-3.5 h-3.5 text-slate-400" /> {member.email}
                        </span>
                        {member.phone && (
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <Phone className="w-3.5 h-3.5 text-slate-400" /> {member.phone}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(member.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        {member.status}
                      </span>
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
