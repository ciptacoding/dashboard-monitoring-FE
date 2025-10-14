// src/lib/api.ts
import { Camera } from '@/types/camera';

const API_BASE = (import.meta as any).env.VITE_API_BASE || '';

type BackendCamera = {
  id: string;
  name: string;
  rtspUrl: string;
  hlsPath: string;
  hlsUrl: string;        // internal
  hlsUrlPublic: string;  // public for FE player
  latitude: number;
  longitude: number;
  building?: string | null;
  zone?: string | null;
  tags?: string[];
  status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
  lastSeen?: string | null;
};

const mapToCamera = (c: BackendCamera): Camera => ({
  id: c.id,
  name: c.name,
  streamUrlHls: c.hlsUrlPublic || c.hlsUrl, // prefer public, fallback internal
  latitude: c.latitude,
  longitude: c.longitude,
  building: c.building || undefined,
  zone: c.zone || undefined,
  tags: c.tags || [],
  status: c.status,
  lastSeen: c.lastSeen || undefined,
});

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return res.json();
}

export const api = {
  cameras: {
    async getAll(): Promise<Camera[]> {
      const data = await http<BackendCamera[]>('/api/cameras');
      return data.map(mapToCamera);
    },
    async create(input: Omit<BackendCamera,'id'|'hlsUrl'|'hlsUrlPublic'>): Promise<Camera> {
      const data = await http<BackendCamera>('/api/cameras', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return mapToCamera(data);
    },
    async update(id: string, updates: Partial<BackendCamera>): Promise<Camera> {
      const data = await http<BackendCamera>(`/api/cameras/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      return mapToCamera(data);
    },
    async delete(id: string): Promise<void> {
      await fetch(`${API_BASE}/api/cameras/${id}`, { method: 'DELETE' });
    },
  },
};
