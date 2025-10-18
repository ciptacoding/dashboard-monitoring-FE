import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '@/lib/api';

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      login: async (username: string, password: string) => {
        try {
          const response = await authAPI.login({ username, password});
          localStorage.setItem('auth_token', response.token);
          localStorage.setItem('auth_user', JSON.stringify(response.user));

          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');

          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });

          const errorMessage = error.message || 'Invalid username or password';
          throw new Error(errorMessage);
        }            
      },

      logout: () => {
        authAPI.logout();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      checkAuth: async () => {
        const token = localStorage.getItem('auth_token');
        const userStr = localStorage.getItem('auth_user');

        if (!token || !userStr) {
          set({
            isAuthenticated: false,
            user: null,
            token: null,
            isLoading: false,
          });
          return;
        }

        try {
          const storedUser = JSON.parse(userStr);
          const user = await authAPI.getCurrentUser();

          set({
            token,
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          console.error('Auth verification failed:', error);
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');

          set({
            isAuthenticated: false,
            token: null,
            user: null,
            isLoading: false,
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
    }
  )
);
