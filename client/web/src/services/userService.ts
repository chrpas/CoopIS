import { api } from "./api";
import { UserAccount, CreateUserPayload, UpdateUserRolePayload } from "../types";

export const userService = {
  getUsers: async (): Promise<UserAccount[]> => {
    const res = await api.get<UserAccount[]>("/users");
    return res.data;
  },

  getUserById: async (id: string): Promise<UserAccount> => {
    const res = await api.get<UserAccount>(`/users/${id}`);
    return res.data;
  },

  createUser: async (payload: CreateUserPayload): Promise<UserAccount> => {
    const res = await api.post<UserAccount>("/users", payload);
    return res.data;
  },

  updateUserRoleOrStatus: async (
    id: string,
    payload: UpdateUserRolePayload
  ): Promise<UserAccount> => {
    const res = await api.put<UserAccount>(`/users/${id}/role`, payload);
    return res.data;
  },

  deleteOrDeactivateUser: async (id: string): Promise<{ message: string }> => {
    const res = await api.delete<{ message: string }>(`/users/${id}`);
    return res.data;
  },
};
