// One photo scan at a time, shared by onboarding and the You tab.
// The scan keeps going while you move between screens.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { getPhotoAccess, getScanStats, scanPhotos, ScanProgress, ScanResult, ScanStats } from '@/lib/photoScan';
import { useNearMisses } from '@/lib/nearMisses';

type ScanState = {
  running: boolean;
  progress: ScanProgress | null;
  result: ScanResult | null;
  error: string | null;
  stats: ScanStats | null;
  start: () => Promise<ScanResult | null>;
  stop: () => void;
  refreshStats: () => Promise<void>;
  reset: () => void;
  autoScan: () => Promise<void>;
};

const AUTO_KEY = 'nearmiss.autoscan.last';
const AUTO_EVERY_MS = 12 * 60 * 60 * 1000;

let signal = { cancelled: false };

export const useScan = create<ScanState>((set, get) => ({
  running: false,
  progress: null,
  result: null,
  error: null,
  stats: null,
  start: async () => {
    if (get().running) return null;
    signal = { cancelled: false };
    set({ running: true, error: null, result: null, progress: null });
    try {
      const result = await scanPhotos({ signal, onProgress: (progress) => set({ progress }) });
      set({ result });
      await get().refreshStats();
      // New photos can mean new near misses.
      useNearMisses.getState().load({ rematch: true });
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn('Photo scan failed', e);
      set({ error: message });
      return null;
    } finally {
      set({ running: false });
    }
  },
  stop: () => { signal.cancelled = true; },
  refreshStats: async () => {
    const stats = await getScanStats();
    if (stats) set({ stats });
  },
  // Quietly picks up photos that have aged past 30 days since the last scan.
  // Runs at most every 12 hours, only for people who already scanned and still allow full access.
  autoScan: async () => {
    try {
      if (get().running) return;
      const last = Number((await AsyncStorage.getItem(AUTO_KEY)) ?? 0);
      if (Date.now() - last < AUTO_EVERY_MS) return;
      const access = await getPhotoAccess();
      if (access !== 'granted' && access !== 'limited') return;
      const stats = await getScanStats();
      if (!stats || stats.points === 0) return;
      await AsyncStorage.setItem(AUTO_KEY, String(Date.now()));
      await get().start();
    } catch (e) {
      console.warn('Background photo check failed', e);
    }
  },
  reset: () => {
    signal.cancelled = true;
    set({ running: false, progress: null, result: null, error: null, stats: null });
  },
}));
