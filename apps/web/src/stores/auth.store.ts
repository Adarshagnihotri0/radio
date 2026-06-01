import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  username: string | null;
  isAuthenticated: boolean;
  setTokens: (tokens: { accessToken: string; refreshToken: string; userId: string; username: string }) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      userId: null,
      username: null,
      isAuthenticated: false,

      setTokens: ({ accessToken, refreshToken, userId, username }) => {
        set({ accessToken, refreshToken, userId, username, isAuthenticated: true });
      },

      clearAuth: () => {
        set({
          accessToken: null,
          refreshToken: null,
          userId: null,
          username: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'radius-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        userId: state.userId,
        username: state.username,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
