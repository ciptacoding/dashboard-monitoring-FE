import { create } from 'zustand';
import { Camera } from '@/types/camera';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface CamerasState {
  cameras: Camera[];
  selectedCameraIds: string[];
  loading: boolean;
  error: string | null;
  
  // Camera refresh tracking untuk handle frozen streams
  cameraRefreshTimestamps: Record<string, number>;
  
  // Actions
  setCameras: (cameras: Camera[]) => void;
  addCamera: (camera: Camera) => void;
  updateCamera: (id: string, camera: Partial<Camera>) => void;
  deleteCamera: (id: string) => void;
  setSelectedCameraIds: (ids: string[]) => void;
  updateCameraStatus: (id: string, status: string, lastSeen?: string) => void;
  
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

  updateCameraStatus: (id, status, lastSeen) => {
    set((state) => ({
      cameras: state.cameras.map((cam) =>
        cam.id === id
          ? {
              ...cam,
              status: status as any,
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

  // Check if camera should be refreshed (not refreshed in last 10 seconds)
  shouldRefreshCamera: (id) => {
    const lastRefresh = get().cameraRefreshTimestamps[id] || 0;
    const now = Date.now();
    const minRefreshInterval = 10000; // 10 seconds
    
    return now - lastRefresh > minRefreshInterval;
  },

  // Refresh camera stream
  refreshCameraStream: async (id) => {
    const state = get();
    const camera = state.cameras.find((c) => c.id === id);
    
    if (!camera) {
      console.error('Camera not found:', id);
      return;
    }

    // Check if we should refresh (rate limiting)
    if (!state.shouldRefreshCamera(id)) {
      console.log('Camera refresh rate limited:', id);
      return;
    }

    try {
      console.log('🔄 Refreshing camera stream:', camera.name);
      
      // Mark as refreshing
      state.markCameraForRefresh(id);
      
      // Stop existing stream
      try {
        await api.cameras.stopStream(id);
      } catch (error) {
        console.warn('Error stopping stream (may already be stopped):', error);
      }

      // Wait a bit before restarting
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Start stream again
      const updatedCamera = await api.cameras.startStream(id);
      
      // Update camera in state
      state.updateCamera(id, updatedCamera);
      
      console.log('✅ Camera stream refreshed:', camera.name);
      
      toast.success('Stream Refreshed', {
        description: `${camera.name} stream has been refreshed`,
      });
    } catch (error) {
      console.error('Error refreshing camera stream:', error);
      
      toast.error('Refresh Failed', {
        description: `Failed to refresh ${camera.name}. Will retry automatically.`,
      });
    }
  },

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));