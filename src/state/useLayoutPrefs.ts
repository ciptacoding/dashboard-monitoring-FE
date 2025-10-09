import { create } from 'zustand';
import { GridLayout } from '@/types/camera';

interface LayoutPrefsState {
  gridLayout: GridLayout;
  autoPlayPreview: boolean;
  splitRatio: number; // 0 = full map, 50 = 50:50, 100 = full grid
  setGridLayout: (layout: GridLayout) => void;
  setAutoPlayPreview: (value: boolean) => void;
  setSplitRatio: (ratio: number) => void;
  loadPreferences: () => void;
  savePreferences: () => void;
}

const STORAGE_KEY = 'cctv_layout_prefs';

export const useLayoutPrefs = create<LayoutPrefsState>((set, get) => ({
  gridLayout: '2x2',
  autoPlayPreview: false,
  splitRatio: 50,

  setGridLayout: (layout) => {
    set({ gridLayout: layout });
    get().savePreferences();
  },

  setAutoPlayPreview: (value) => {
    set({ autoPlayPreview: value });
    get().savePreferences();
  },

  setSplitRatio: (ratio) => {
    set({ splitRatio: ratio });
    get().savePreferences();
  },

  loadPreferences: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const prefs = JSON.parse(stored);
        set({
          gridLayout: prefs.gridLayout || '2x2',
          autoPlayPreview: prefs.autoPlayPreview || false,
          splitRatio: prefs.splitRatio ?? 50,
        });
      }
    } catch (error) {
      console.error('Failed to load layout preferences:', error);
    }
  },

  savePreferences: () => {
    try {
      const { gridLayout, autoPlayPreview, splitRatio } = get();
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ gridLayout, autoPlayPreview, splitRatio })
      );
    } catch (error) {
      console.error('Failed to save layout preferences:', error);
    }
  },
}));
