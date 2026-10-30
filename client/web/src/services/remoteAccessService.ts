import { api } from "./api";
import {
  RemoteAccessStatus,
  RemoteAccessSettings,
  UpdateRemoteAccessSettingsRequest,
} from "../types";

export const remoteAccessService = {
  getStatus: async (): Promise<RemoteAccessStatus> => {
    const res = await api.get<RemoteAccessStatus>("/remote-access/status");
    return res.data;
  },

  getSettings: async (): Promise<RemoteAccessSettings> => {
    const res = await api.get<RemoteAccessSettings>("/remote-access/settings");
    return res.data;
  },

  updateSettings: async (
    data: UpdateRemoteAccessSettingsRequest
  ): Promise<RemoteAccessSettings> => {
    const res = await api.put<RemoteAccessSettings>("/remote-access/settings", data);
    return res.data;
  },

  start: async (): Promise<RemoteAccessStatus> => {
    const res = await api.post<RemoteAccessStatus>("/remote-access/start");
    return res.data;
  },

  stop: async (): Promise<RemoteAccessStatus> => {
    const res = await api.post<RemoteAccessStatus>("/remote-access/stop");
    return res.data;
  },
};
