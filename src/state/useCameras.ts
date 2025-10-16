import { create } from 'zustand';
import { Camera } from '@/types/camera';
import { cameraAPI } from '@/lib/api';

interface CamerasState {
  cameras: Camera[];
  selectedCameraIds: string[];
  loading: boolean;
  error: string | null;
  fetchCameras: () => Promise<void>;
  setCameras: (cameras: Camera[]) => void;
  addCamera: (camera: Camera) => void;
  updateCamera: (id: string, updates: Partial<Camera>) => void;
  deleteCamera: (id: string) => void;
  setSelectedCameraIds: (ids: string[]) => void;
  updateCameraStatus: (id: string, status: Camera['status'], lastSeen?: string) => void;
}

// Mock initial cameras
// const MOCK_CAMERAS: Camera[] = [
//   {
//     id: '1',
//     name: 'Main Entrance',
//     streamUrlHls: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
//     latitude: -0.973351,
//     longitude: 116.708536,
//     building: 'Building A',
//     zone: 'Entrance',
//     tags: ['entrance', 'main'],
//     status: 'ONLINE',
//     lastSeen: new Date().toISOString(),
//   },
//   {
//     id: '2',
//     name: 'Parking Area',
//     streamUrlHls: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
//     latitude: -0.974351,
//     longitude: 116.709536,
//     building: 'Building A',
//     zone: 'Parking',
//     tags: ['parking', 'outdoor'],
//     status: 'ONLINE',
//     lastSeen: new Date().toISOString(),
//   },
//   {
//     id: '3',
//     name: 'Server Room',
//     streamUrlHls: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
//     latitude: -0.972351,
//     longitude: 116.707536,
//     building: 'Building B',
//     zone: 'Server',
//     tags: ['critical', 'indoor'],
//     status: 'OFFLINE',
//     lastSeen: new Date(Date.now() - 3600000).toISOString(),
//   },
//   {
//     id: '4',
//     name: 'Lobby Camera',
//     streamUrlHls: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
//     latitude: -0.975351,
//     longitude: 116.710536,
//     building: 'Building A',
//     zone: 'Lobby',
//     tags: ['lobby', 'main'],
//     status: 'ONLINE',
//     lastSeen: new Date().toISOString(),
//   },
// ];

export const useCameras = create<CamerasState>((set) => ({
  cameras: [],
  selectedCameraIds: [],
  loading: false,
  error: null,
  
  fetchCameras: async () => {
    set({ loading: true, error: null });
    try {
      const response = await cameraAPI.getAll();
      set({ cameras: response.data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  
  setCameras: (cameras) => set({ cameras }),
  
  addCamera: (camera) =>
    set((state) => ({
      cameras: [...state.cameras, camera],
    })),
    
  updateCamera: (id, updates) =>
    set((state) => ({
      cameras: state.cameras.map((cam) =>
        cam.id === id ? { ...cam, ...updates } : cam
      ),
    })),
    
  deleteCamera: (id) =>
    set((state) => ({
      cameras: state.cameras.filter((cam) => cam.id !== id),
      selectedCameraIds: state.selectedCameraIds.filter((cid) => cid !== id),
    })),
    
  setSelectedCameraIds: (ids) => set({ selectedCameraIds: ids }),
  
  updateCameraStatus: (id, status, lastSeen) =>
    set((state) => ({
      cameras: state.cameras.map((cam) =>
        cam.id === id ? { ...cam, status, last_seen: lastSeen || cam.last_seen } : cam
      ),
    })),
}));
