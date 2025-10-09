import { create } from 'zustand';

interface AuthState {
  user: { email: string } | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  login: async (email: string, password: string, remember: boolean) => {
    // Mock authentication - replace with real API call
    if (email && password) {
      const mockToken = `mock-jwt-${Date.now()}`;
      
      if (remember) {
        localStorage.setItem('auth_token', mockToken);
        localStorage.setItem('auth_user', JSON.stringify({ email }));
      }

      set({
        user: { email },
        token: mockToken,
        isAuthenticated: true,
      });
    } else {
      throw new Error('Invalid credentials');
    }
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },

  checkAuth: () => {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('auth_user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({
          user,
          token,
          isAuthenticated: true,
        });
      } catch {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    }
  },
}));
