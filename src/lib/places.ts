// Hidden places (home, work, ...). Photos taken inside one are never saved or matched.
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { resetScanCursor } from '@/lib/photoScan';

export type HiddenPlace = { id: string; label: string; latitude: number; longitude: number; radius_m: number };
export const RADII = [200, 300, 500, 1000] as const;

type PlacesState = {
  places: HiddenPlace[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (p: Omit<HiddenPlace, 'id'>) => Promise<void>;
  update: (id: string, p: Omit<HiddenPlace, 'id'>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reset: () => void;
};

const point = (lat: number, lng: number) => `SRID=4326;POINT(${lng.toFixed(6)} ${lat.toFixed(6)})`;

export const usePlaces = create<PlacesState>((set, get) => ({
  places: [],
  loaded: false,
  load: async () => {
    const { data, error } = await supabase.rpc('my_hidden_zones');
    if (error) throw new Error(error.message);
    set({ places: (data ?? []) as HiddenPlace[], loaded: true });
  },
  add: async ({ label, latitude, longitude, radius_m }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Sign in to add a place.');
    const { error } = await supabase.from('hidden_zones').insert({ user_id: user.id, label: label.trim().slice(0, 40), center: point(latitude, longitude), radius_m });
    if (error) throw new Error(error.message);
    await get().load();
    // Photos already saved inside the place were removed by the database; regroup what's left.
    await supabase.rpc('rebuild_my_moments');
  },
  update: async (id, { label, latitude, longitude, radius_m }) => {
    const { error } = await supabase.from('hidden_zones').update({ label: label.trim().slice(0, 40), center: point(latitude, longitude), radius_m }).eq('id', id);
    if (error) throw new Error(error.message);
    await get().load();
    await supabase.rpc('rebuild_my_moments');
  },
  remove: async (id) => {
    const { error } = await supabase.from('hidden_zones').delete().eq('id', id);
    if (error) throw new Error(error.message);
    set({ places: get().places.filter((p) => p.id !== id) });
    // The next rescan reads every photo again so ones taken there can be included.
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await resetScanCursor(user.id);
  },
  reset: () => set({ places: [], loaded: false }),
}));
