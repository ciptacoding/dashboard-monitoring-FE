import { Camera, CreateCameraRequest, UpdateCameraRequest, ApiResponse, PaginatedResponse } from '@/types/camera';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api/v1';

// Get auth token from localStorage
const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

// HTTP client with JWT authentication
async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }
    
    const errorData = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(errorData.message || `HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

// Authentication API
export const authAPI = {
  async login(credentials: { username: string; password: string }): Promise<{ token: string; user: any }> {
    const response = await http<ApiResponse<{ token: string; user: any }>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    return response.data;
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
