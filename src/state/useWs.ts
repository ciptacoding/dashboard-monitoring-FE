import { create } from 'zustand';

interface WsState {
  connected: boolean;
  setConnected: (connected: boolean) => void;
}

export const useWs = create<WsState>((set) => ({
  connected: false,
  setConnected: (connected) => set({ connected }),
}));
