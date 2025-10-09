export type CameraStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export interface Camera {
  id: string;
  name: string;
  streamUrlHls: string;
  thumbnailUrl?: string;
  latitude: number;
  longitude: number;
  building?: string;
  zone?: string;
  tags?: string[];
  status: CameraStatus;
  lastSeen?: string; // ISO string
}

export type WsEvent =
  | { type: 'camera_status'; id: string; status: CameraStatus; lastSeen?: string }
  | { type: 'camera_not_found'; id: string }
  | { type: 'motion_detected'; id: string; ts: string }
  | { type: 'ping' };

export type GridLayout = '2x2' | '4x4' | '2x4' | '6x4' | '3x6';

export interface GridLayoutConfig {
  cols: number;
  rows: number;
}

export const GRID_LAYOUTS: Record<GridLayout, GridLayoutConfig> = {
  '2x2': { cols: 2, rows: 2 },
  '4x4': { cols: 4, rows: 4 },
  '2x4': { cols: 2, rows: 4 },
  '6x4': { cols: 6, rows: 4 },
  '3x6': { cols: 3, rows: 6 },
};
