import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      setTokens: ({ accessToken, refreshToken, userId, username }) =>
        set({ accessToken, refreshToken, userId, username, isAuthenticated: true }),
      clearAuth: () =>
        set({ accessToken: null, refreshToken: null, userId: null, username: null, isAuthenticated: false }),
    }),
    {
      name: 'radius-auth',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
