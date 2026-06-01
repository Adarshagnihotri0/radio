import { apiClient } from './api.client';

export interface Channel {
  _id: string;
  name: string;
  description: string;
  frequency: string;
  center: { type: 'Point'; coordinates: [number, number] };
  radiusKm: number;
  activeUsers: number;
  encrypted: boolean;
  isPrivate: boolean;
  maxUsers: number;
}

export const channelsApi = {
  list: (page = 1, limit = 20) =>
    apiClient
      .get<{ data: Channel[]; total: number }>('/channels', { params: { page, limit } })
      .then((r) => r.data),

  nearby: (lat: number, lng: number, radiusKm = 25) =>
    apiClient
      .get<Channel[]>('/channels/nearby', { params: { latitude: lat, longitude: lng, radiusKm } })
      .then((r) => r.data),

  getById: (id: string) =>
    apiClient.get<Channel>(`/channels/${id}`).then((r) => r.data),

  create: (data: {
    name: string;
    frequency: string;
    latitude: number;
    longitude: number;
    radiusKm: number;
    description?: string;
    encrypted?: boolean;
    isPrivate?: boolean;
    maxUsers?: number;
  }) =>
    apiClient.post<Channel>('/channels', data).then((r) => r.data),

  update: (id: string, data: Partial<Channel>) =>
    apiClient.put<Channel>(`/channels/${id}`, data).then((r) => r.data),

  remove: (id: string) =>
    apiClient.delete(`/channels/${id}`),
};
