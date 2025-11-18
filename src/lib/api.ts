import { Camera, CreateCameraRequest, UpdateCameraRequest, ApiResponse, PaginatedResponse, CameraPreview } from '@/types/camera';

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

// HTTP client configuration
const HTTP_CONFIG = {
  timeout: 30000, // 30 seconds default timeout
  maxRetries: 3,
  retryDelay: 1000, // Start with 1 second
  retryableStatuses: [408, 429, 500, 502, 503, 504], // Status codes that should be retried
  retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR'],
};

// Create AbortController with timeout
function createTimeoutController(timeoutMs: number): { controller: AbortController; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const cleanup = () => clearTimeout(timeoutId);
  return { controller, cleanup };
}

// Sleep utility for retry delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Calculate exponential backoff delay
function getRetryDelay(attempt: number, baseDelay: number = HTTP_CONFIG.retryDelay): number {
  return Math.min(baseDelay * Math.pow(2, attempt), 10000); // Max 10 seconds
}

// HTTP client dengan JWT authentication, retry mechanism, timeout, dan proper error handling
async function http<T>(
  path: string, 
  init?: RequestInit & { 
    timeout?: number;
    retries?: number;
    skipRetry?: boolean;
  }
): Promise<T> {
  const token = getAuthToken();
  const timeout = init?.timeout ?? HTTP_CONFIG.timeout;
  const maxRetries = init?.retries ?? HTTP_CONFIG.maxRetries;
  const skipRetry = init?.skipRetry ?? false;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  let lastError: Error | null = null;

  // Retry loop
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let timeoutCleanup: (() => void) | null = null;
    
    try {
      // Create timeout controller for this attempt
      const { controller, cleanup } = createTimeoutController(timeout);
      timeoutCleanup = cleanup;
      
      // Merge abort signals if provided
      let abortSignal = controller.signal;
      if (init?.signal) {
        const combinedController = new AbortController();
        const abort = () => combinedController.abort();
        controller.signal.addEventListener('abort', abort);
        init.signal.addEventListener('abort', abort);
        abortSignal = combinedController.signal;
      }

      const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        signal: abortSignal,
        headers: {
          ...headers,
          ...init?.headers,
        },
      });

      // Clear timeout on success
      if (timeoutCleanup) {
        timeoutCleanup();
        timeoutCleanup = null;
      }

      // Parse response body
      let data: any;
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        // If response is not JSON, create error
        throw new ApiError(
          'Invalid response format',
          'PARSE_ERROR',
          res.status,
          'Response is not valid JSON'
        );
      }

      if (!res.ok) {
        // Handle error response dengan error code
        const errorCode = data.error?.code || 'UNKNOWN_ERROR';
        const errorMessage = data.error?.message || data.message || 'An error occurred';
        const errorDetails = data.error?.details;

        // Handle 401 Unauthorized - don't retry
        if (res.status === 401) {
          if (errorCode === 'TOKEN_EXPIRED' || errorCode === 'TOKEN_INVALID') {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login';
            }
          }
          throw new ApiError(errorMessage, errorCode, res.status, errorDetails);
        }

        // Handle 429 Rate Limit - retry with longer delay
        if (res.status === 429) {
          const retryAfter = res.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : getRetryDelay(attempt, 2000);
          
          if (attempt < maxRetries && !skipRetry) {
            console.warn(`⚠️ Rate limited. Retrying after ${delay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
            await sleep(delay);
            continue;
          }
          
          throw new ApiError(
            errorMessage || 'Rate limit exceeded. Please try again later.',
            'RATE_LIMIT_EXCEEDED',
            res.status,
            errorDetails
          );
        }

        // Check if status is retryable
        if (HTTP_CONFIG.retryableStatuses.includes(res.status) && attempt < maxRetries && !skipRetry) {
          const delay = getRetryDelay(attempt);
          console.warn(`⚠️ Request failed with ${res.status}. Retrying after ${delay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
          await sleep(delay);
          continue;
        }

        throw new ApiError(errorMessage, errorCode, res.status, errorDetails);
      }

      return data;
    } catch (error) {
      // Cleanup timeout on error
      if (timeoutCleanup) {
        timeoutCleanup();
        timeoutCleanup = null;
      }
      
      lastError = error as Error;

      // Handle AbortError (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        if (attempt < maxRetries && !skipRetry) {
          const delay = getRetryDelay(attempt);
          console.warn(`⏱️ Request timeout. Retrying after ${delay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
          await sleep(delay);
          continue;
        }
        throw new ApiError(
          'Request timeout. Please check your connection.',
          'TIMEOUT_ERROR',
          0,
          `Request exceeded ${timeout}ms timeout`
        );
      }

      // Re-throw ApiError (don't retry for known errors unless retryable)
      if (error instanceof ApiError) {
        // Check if error is retryable
        if (
          HTTP_CONFIG.retryableErrors.includes(error.code) &&
          attempt < maxRetries &&
          !skipRetry
        ) {
          const delay = getRetryDelay(attempt);
          console.warn(`⚠️ ${error.code}. Retrying after ${delay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
          await sleep(delay);
          continue;
        }
        throw error;
      }

      // Network error - retry if possible
      if (attempt < maxRetries && !skipRetry) {
        const delay = getRetryDelay(attempt);
        console.warn(`⚠️ Network error. Retrying after ${delay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
        await sleep(delay);
        continue;
      }

      // Final attempt failed
      throw new ApiError(
        'Network error. Please check your connection.',
        'NETWORK_ERROR',
        0,
        error instanceof Error ? error.message : undefined
      );
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new ApiError('Request failed after all retries', 'MAX_RETRIES_EXCEEDED', 0);
}

// Authentication API
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

  // NEW: Backend logout endpoint
  async logout(): Promise<void> {
    try {
      await http<ApiResponse<void>>('/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      // Log error but don't throw - local cleanup still happens
      console.error('Logout API call failed:', error);
    }
  },

  // Local logout (clear storage)
  localLogout() {
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
    // Stream operations need longer timeout and more retries
    const response = await http<ApiResponse<Camera>>(`/cameras/${id}/stream/start`, {
      method: 'POST',
      timeout: 60000, // 60 seconds for stream start
      retries: 2, // Fewer retries to avoid overwhelming backend
    });
    return response.data;
  },

  async stopStream(id: string): Promise<Camera> {
    // Stream stop should be faster but still needs timeout
    const response = await http<ApiResponse<Camera>>(`/cameras/${id}/stream/stop`, {
      method: 'POST',
      timeout: 30000, // 30 seconds
      retries: 1, // Only 1 retry for stop operations
    });
    return response.data;
  },

  async getPreview(id: string): Promise<CameraPreview> {
    const response = await http<ApiResponse<CameraPreview>>(`/cameras/${id}/preview`);
    return response.data;
  },

  async reportStreamError(
    id: string, 
    errorType: 'timeout' | 'hls_error' | 'network_error' | 'decode_error' | 'other',
    message: string
  ): Promise<void> {
    await http<ApiResponse<void>>(`/cameras/${id}/stream/error`, {
      method: 'POST',
      body: JSON.stringify({
        error_type: errorType,
        message: message,
      }),
    });
  },
};

export const api = {
  auth: authAPI,
  cameras: cameraAPI,
};