import { create } from 'zustand';
import { Camera } from '@/types/camera';
import { api, ApiError } from '@/lib/api';
import { toast } from 'sonner';

interface CamerasState {
  cameras: Camera[];
  selectedCameraIds: string[];
  loading: boolean;
  error: string | null;
  
  // Camera refresh tracking untuk handle frozen streams
  cameraRefreshTimestamps: Record<string, number>;
  cameraRefreshInProgress: Set<string>; // Track cameras currently being refreshed
  cameraRefreshAttempts: Record<string, number>; // Track retry attempts per camera
  
  // Actions
  setCameras: (cameras: Camera[]) => void;
  addCamera: (camera: Camera) => void;
  updateCamera: (id: string, camera: Partial<Camera>) => void;
  deleteCamera: (id: string) => void;
  setSelectedCameraIds: (ids: string[]) => void;
  updateCameraStatus: (id: string, status: string, lastSeen?: string, statusMessage?: string) => void;
  
  // Auto-refresh actions
  refreshCameraStream: (id: string) => Promise<void>;
  markCameraForRefresh: (id: string) => void;
  shouldRefreshCamera: (id: string) => boolean;
  
  // Loading states
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useCameras = create<CamerasState>((set, get) => ({
  cameras: [],
  selectedCameraIds: [],
  loading: false,
  error: null,
  cameraRefreshTimestamps: {},
  cameraRefreshInProgress: new Set<string>(),
  cameraRefreshAttempts: {},

  setCameras: (cameras) => set({ cameras, error: null }),

  addCamera: (camera) => {
    set((state) => ({
      cameras: [...state.cameras, camera],
    }));
  },

  updateCamera: (id, updatedFields) => {
    set((state) => ({
      cameras: state.cameras.map((cam) =>
        cam.id === id ? { ...cam, ...updatedFields } : cam
      ),
    }));
  },

  deleteCamera: (id) => {
    set((state) => ({
      cameras: state.cameras.filter((cam) => cam.id !== id),
      selectedCameraIds: state.selectedCameraIds.filter((cid) => cid !== id),
    }));
  },

  setSelectedCameraIds: (ids) => set({ selectedCameraIds: ids }),

  updateCameraStatus: (id, status, lastSeen, statusMessage?) => {
    set((state) => ({
      cameras: state.cameras.map((cam) =>
        cam.id === id
          ? {
              ...cam,
              status: status as any,
              status_message: statusMessage || cam.status_message,
              last_seen: lastSeen || cam.last_seen,
            }
          : cam
      ),
    }));
  },

  // Mark camera for refresh (to prevent too frequent refreshes)
  markCameraForRefresh: (id) => {
    set((state) => ({
      cameraRefreshTimestamps: {
        ...state.cameraRefreshTimestamps,
        [id]: Date.now(),
      },
    }));
  },

  // Check if camera should be refreshed (not refreshed in last 10 seconds and not already refreshing)
  shouldRefreshCamera: (id) => {
    const state = get();
    const lastRefresh = state.cameraRefreshTimestamps[id] || 0;
    const now = Date.now();
    const minRefreshInterval = 10000; // 10 seconds
    
    // Don't refresh if already in progress
    if (state.cameraRefreshInProgress.has(id)) {
      return false;
    }
    
    return now - lastRefresh > minRefreshInterval;
  },

  // Refresh camera stream with exponential backoff and rate limiting
  refreshCameraStream: async (id) => {
    const state = get();
    const camera = state.cameras.find((c) => c.id === id);
    
    if (!camera) {
      console.error('Camera not found:', id);
      return;
    }

    // Check if we should refresh (rate limiting)
    if (!state.shouldRefreshCamera(id)) {
      console.log('Camera refresh rate limited or already in progress:', id);
      return;
    }

    // Mark as in progress to prevent concurrent refreshes
    set((state) => ({
      cameraRefreshInProgress: new Set(state.cameraRefreshInProgress).add(id),
    }));

    const attempts = state.cameraRefreshAttempts[id] || 0;
    const maxAttempts = 3;

    try {
      console.log(`🔄 Refreshing camera stream: ${camera.name} (attempt ${attempts + 1}/${maxAttempts})`);
      
      // Mark as refreshing
      state.markCameraForRefresh(id);
      
      // Calculate exponential backoff delay (1s, 2s, 4s)
      const backoffDelay = Math.min(1000 * Math.pow(2, attempts), 4000);
      if (attempts > 0) {
        console.log(`⏳ Waiting ${backoffDelay}ms before refresh (exponential backoff)...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
      
      // Stop existing stream
      try {
        await api.cameras.stopStream(id);
        // Wait a bit before restarting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.warn('Error stopping stream (may already be stopped):', error);
        // Still wait a bit even if stop fails
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Start stream again
      const updatedCamera = await api.cameras.startStream(id);
      
      // Update camera in state
      state.updateCamera(id, updatedCamera);
      
      // Reset attempts on success
      set((state) => {
        const newAttempts = { ...state.cameraRefreshAttempts };
        delete newAttempts[id];
        return { cameraRefreshAttempts: newAttempts };
      });
      
      console.log('✅ Camera stream refreshed:', camera.name);
      
      toast.success('Stream Refreshed', {
        description: `${camera.name} stream has been refreshed`,
      });
    } catch (error: any) {
      console.error('Error refreshing camera stream:', error);
      
      // Handle rate limiting specifically
      const isRateLimit = error instanceof ApiError && error.code === 'RATE_LIMIT_EXCEEDED';
      
      if (isRateLimit) {
        // Extract retry-after from error if available
        const retryAfter = error.details 
          ? parseInt(error.details) * 1000 
          : 5000; // Default 5 seconds for rate limit
        
        console.warn(`⚠️ Rate limited. Will retry after ${retryAfter}ms...`);
        
        // Reset attempts to allow retry after rate limit
        set((state) => ({
          cameraRefreshAttempts: {
            ...state.cameraRefreshAttempts,
            [id]: 0, // Reset attempts for rate limit retry
          },
        }));
        
        setTimeout(() => {
          // Retry after delay
          const currentState = get();
          if (currentState.shouldRefreshCamera(id)) {
            currentState.refreshCameraStream(id);
          }
        }, retryAfter);
      } else if (attempts < maxAttempts - 1) {
        // Increment attempts and retry
        set((state) => ({
          cameraRefreshAttempts: {
            ...state.cameraRefreshAttempts,
            [id]: attempts + 1,
          },
        }));
        
        // Retry with exponential backoff
        const retryDelay = Math.min(2000 * Math.pow(2, attempts), 8000);
        console.log(`🔄 Will retry refresh after ${retryDelay}ms...`);
        
        setTimeout(() => {
          const currentState = get();
          if (currentState.shouldRefreshCamera(id)) {
            currentState.refreshCameraStream(id);
          }
        }, retryDelay);
      } else {
        // Max attempts reached
        set((state) => {
          const newAttempts = { ...state.cameraRefreshAttempts };
          delete newAttempts[id];
          return { cameraRefreshAttempts: newAttempts };
        });
        
        toast.error('Refresh Failed', {
          description: `Failed to refresh ${camera.name} after ${maxAttempts} attempts.`,
          duration: 5000,
        });
      }
    } finally {
      // Remove from in-progress set
      set((state) => {
        const newInProgress = new Set(state.cameraRefreshInProgress);
        newInProgress.delete(id);
        return { cameraRefreshInProgress: newInProgress };
      });
    }
  },

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));