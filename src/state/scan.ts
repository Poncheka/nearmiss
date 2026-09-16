// One photo scan at a time, shared by onboarding and the You tab.
// The scan keeps going while you move between screens.
import { create } from 'zustand';
import { getScanStats, scanPhotos, ScanProgress, ScanResult, ScanStats } from '@/lib/photoScan';

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
};

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
  reset: () => {
    signal.cancelled = true;
    set({ running: false, progress: null, result: null, error: null, stats: null });
  },
}));
