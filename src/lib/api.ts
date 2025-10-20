import { Camera, CreateCameraRequest, UpdateCameraRequest, ApiResponse, PaginatedResponse } from '@/types/camera';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api/v1';

// Custom error class untuk API errors
export class ApiError extends Error {
  code: string;
  details?: string;
  statusCode: number;

  constructor(message: string, code: string, statusCode: number, details?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Get auth token from localStorage
const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

// HTTP client dengan JWT authentication dan proper error handling
async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...headers,
        ...init?.headers,
      },
    });

    // Parse response body
    const data = await res.json();

    if (!res.ok) {
      // Handle error response dengan error code
      const errorCode = data.error?.code || 'UNKNOWN_ERROR';
      const errorMessage = data.error?.message || data.message || 'An error occurred';
      const errorDetails = data.error?.details;

      // Handle 401 Unauthorized
      if (res.status === 401) {
        // Cek apakah ini token expired atau invalid credentials
        if (errorCode === 'TOKEN_EXPIRED' || errorCode === 'TOKEN_INVALID') {
          // Clear auth data
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          
          // Redirect ke login hanya jika bukan di halaman login
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
        }
        
        throw new ApiError(errorMessage, errorCode, res.status, errorDetails);
      }

      // Throw ApiError dengan code untuk handling spesifik
      throw new ApiError(errorMessage, errorCode, res.status, errorDetails);
    }

    return data;
  } catch (error) {
    // Re-throw ApiError
    if (error instanceof ApiError) {
      throw error;
    }

    // Network error atau JSON parse error
    throw new ApiError(
      'Network error. Please check your connection.',
      'NETWORK_ERROR',
      0,
      error instanceof Error ? error.message : undefined
    );
  }
}

// Authentication API
export const authAPI = {
  async login(credentials: { username: string; password: string }): Promise<{ token: string; user: any }> {
    try {
      const response = await http<ApiResponse<{ token: string; user: any }>>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      return response.data;
    } catch (error) {
      // Re-throw dengan context yang lebih jelas
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Login failed', 'LOGIN_ERROR', 500);
    }
  },

  async register(data: { username: string; password: string; email?: string }): Promise<{ token: string; user: any }> {
    const response = await http<ApiResponse<{ token: string; user: any }>>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  },

  async getCurrentUser(): Promise<any> {
    const response = await http<ApiResponse<any>>('/auth/me');
    return response.data;
  },

  logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  },
};

// Camera API
export const cameraAPI = {
  async getAll(params?: { page?: number; page_size?: number; zone?: string; status?: string }): Promise<PaginatedResponse<Camera>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
    if (params?.zone) queryParams.append('zone', params.zone);
    if (params?.status) queryParams.append('status', params.status);
    
    const query = queryParams.toString();
    return http<PaginatedResponse<Camera>>(`/cameras${query ? `?${query}` : ''}`);
  },

  async getById(id: string): Promise<Camera> {
    const response = await http<ApiResponse<Camera>>(`/cameras/${id}`);
    return response.data;
  },

  async create(data: CreateCameraRequest): Promise<Camera> {
    const response = await http<ApiResponse<Camera>>('/cameras', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  },

  async update(id: string, data: UpdateCameraRequest): Promise<Camera> {
    const response = await http<ApiResponse<Camera>>(`/cameras/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await http<ApiResponse<void>>(`/cameras/${id}`, {
      method: 'DELETE',
    });
  },

  async getByZone(zone: string): Promise<Camera[]> {
    const response = await http<ApiResponse<Camera[]>>(`/cameras/zone/filter?zone=${encodeURIComponent(zone)}`);
    return response.data;
  },

  async getNearby(lat: number, lng: number, radius: number = 10): Promise<Camera[]> {
    const response = await http<ApiResponse<Camera[]>>(`/cameras/nearby?lat=${lat}&lng=${lng}&radius=${radius}`);
    return response.data;
  },

  async startStream(id: string): Promise<Camera> {
    const response = await http<ApiResponse<Camera>>(`/cameras/${id}/stream/start`, {
      method: 'POST',
    });
    return response.data;
  },

  async stopStream(id: string): Promise<Camera> {
    const response = await http<ApiResponse<Camera>>(`/cameras/${id}/stream/stop`, {
      method: 'POST',
    });
    return response.data;
  },
};

export const api = {
  auth: authAPI,
  cameras: cameraAPI,
};