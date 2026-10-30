import { api } from "./api";
import {
  Member,
  MemberDetail,
  MemberStatus,
  PagedResult,
  CreateMemberPayload,
  UpdateMemberPayload,
} from "../types";

export interface MemberQueryParams {
  search?: string;
  status?: MemberStatus | "";
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export const memberService = {
  getMembers: async (params: MemberQueryParams = {}): Promise<PagedResult<Member>> => {
    const queryParams: Record<string, string | number> = {};
    if (params.search) queryParams.search = params.search;
    if (params.status) queryParams.status = params.status;
    if (params.sortBy) queryParams.sortBy = params.sortBy;
    if (params.sortOrder) queryParams.sortOrder = params.sortOrder;
    if (params.page !== undefined) queryParams.page = params.page;
    if (params.pageSize !== undefined) queryParams.pageSize = params.pageSize;

    const res = await api.get<PagedResult<Member>>("/members", { params: queryParams });
    return res.data;
  },

  getMemberById: async (id: string): Promise<MemberDetail> => {
    const res = await api.get<MemberDetail>(`/members/${id}`);
    return res.data;
  },

  createMember: async (payload: CreateMemberPayload): Promise<Member> => {
    const res = await api.post<Member>("/members", payload);
    return res.data;
  },

  updateMember: async (id: string, payload: UpdateMemberPayload): Promise<Member> => {
    const res = await api.put<Member>(`/members/${id}`, payload);
    return res.data;
  },

  updateMemberStatus: async (id: string, status: MemberStatus): Promise<Member> => {
    const res = await api.patch<Member>(`/members/${id}/status`, { status });
    return res.data;
  },

  deleteOrSuspendMember: async (id: string): Promise<{ message: string }> => {
    const res = await api.delete<{ message: string }>(`/members/${id}`);
    return res.data;
  },
};
