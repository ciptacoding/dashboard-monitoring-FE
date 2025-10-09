import { Camera } from '@/types/camera';

const API_BASE = '/api';

export const api = {
  cameras: {
    getAll: async (): Promise<Camera[]> => {
      // Mock implementation - replace with real API
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve([]);
        }, 500);
      });
    },

    create: async (camera: Omit<Camera, 'id'>): Promise<Camera> => {
      // Mock implementation
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ ...camera, id: Date.now().toString() } as Camera);
        }, 500);
      });
    },

    update: async (id: string, updates: Partial<Camera>): Promise<Camera> => {
      // Mock implementation
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ id, ...updates } as Camera);
        }, 500);
      });
    },

    delete: async (id: string): Promise<void> => {
      // Mock implementation
      return new Promise((resolve) => {
        setTimeout(resolve, 500);
      });
    },
  },
};
