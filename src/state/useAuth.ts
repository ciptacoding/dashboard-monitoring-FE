import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI, ApiError } from '@/lib/api';

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
  error: { message: string; code: string } | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await authAPI.login({ username, password });
          
          localStorage.setItem('auth_token', response.token);
          localStorage.setItem('auth_user', JSON.stringify(response.user));

          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');

          let errorMessage = 'Login failed';
          let errorCode = 'LOGIN_ERROR';

          if (error instanceof ApiError) {
            errorMessage = error.message;
            errorCode = error.code;
          } else if (error.message) {
            errorMessage = error.message;
          }

          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: { message: errorMessage, code: errorCode },
          });

          throw error;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        
        try {
          // Call backend logout endpoint to blacklist token
          await authAPI.logout();
        } catch (error) {
          console.error('Backend logout failed:', error);
          // Continue with local logout even if backend fails
        } finally {
          // Always clear local storage
          authAPI.localLogout();
          
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
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
          
          // Verify token dengan backend
          const user = await authAPI.getCurrentUser();

          set({
            token,
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          console.error('Auth verification failed:', error);
          
          // Clear auth data
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');

          let errorCode = 'AUTH_CHECK_FAILED';
          let errorMessage = 'Session verification failed';

          if (error instanceof ApiError) {
            errorCode = error.code;
            errorMessage = error.message;
          }

          set({
            isAuthenticated: false,
            token: null,
            user: null,
            isLoading: false,
            error: { message: errorMessage, code: errorCode },
          });
        }
      },

      clearError: () => {
        set({ error: null });
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