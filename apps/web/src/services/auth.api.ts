import { apiClient } from './api.client';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  userId: string;
  username: string;
}

export const authApi = {
  register: (data: { username: string; email: string; password: string }): Promise<AuthTokens> =>
    apiClient.post<AuthTokens>('/auth/register', data).then((r) => r.data),

  login: (data: { email: string; password: string }): Promise<AuthTokens> =>
    apiClient.post<AuthTokens>('/auth/login', data).then((r) => r.data),

  logout: (): Promise<void> =>
    apiClient.post<void>('/auth/logout').then((r) => r.data),
};
