// Real near misses from the database (the matching runs on the server).
import { Platform } from 'react-native';
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export type RealNearMiss = {
  id: string;
  other_id: string;
  other_username: string | null;
  other_name: string | null;
  other_avatar_url: string | null;
  via_id: string | null;
  via_name: string | null;
  closest_at: string;
  night: string;
  distance_m: number;
  place_name: string | null;
  my_lat: number;
  my_lng: number;
  their_lat: number;
  their_lng: number;
  is_before_met: boolean;
  is_new: boolean;
  comment_count: number;
  unread_count: number;
};

export type NearMissComment = { id: string; author_id: string; body: string; created_at: string };

type State = {
  items: RealNearMiss[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  lastRefresh: number;
  load: (opts?: { rematch?: boolean }) => Promise<void>;
  markRead: (id: string) => void;
  reset: () => void;
};

const REMATCH_EVERY_MS = 10 * 60 * 1000;

export const otherName = (n: Pick<RealNearMiss, 'other_name' | 'other_username'>) =>
  n.other_name?.split(' ')[0] || (n.other_username ? `@${n.other_username}` : 'A friend');

export const placeLabel = (n: Pick<RealNearMiss, 'place_name'>) => n.place_name || 'Somewhere nearby';

export const formatWhen = (iso: string) => {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    short: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase(),
    year: d.getFullYear(),
  };
};

// Looks up a readable place name on the phone (Apple Maps), then saves it for both people.
const naming = new Set<string>();
async function namePlaces(items: RealNearMiss[], update: (id: string, name: string) => void) {
  if (Platform.OS === 'web') return;
  let Location: typeof import('expo-location');
  try { Location = require('expo-location'); } catch { return; }
  const todo = items.filter((n) => !n.place_name && !naming.has(n.id)).slice(0, 15);
  for (const n of todo) {
    naming.add(n.id);
    try {
      const lat = (n.my_lat + n.their_lat) / 2;
      const lng = (n.my_lng + n.their_lng) / 2;
      const [p] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (!p) continue;
      const street = [p.streetNumber, p.street].filter(Boolean).join(' ');
      const main = p.name && p.name !== street && !/^\d/.test(p.name) ? p.name : p.district || p.street || p.city;
      const name = [main, p.city && p.city !== main ? p.city : null].filter(Boolean).join(', ');
      if (!name) continue;
      update(n.id, name);
      await supabase.rpc('set_near_miss_place', { nm_id: n.id, name });
      await new Promise((r) => setTimeout(r, 400)); // Apple limits how fast we can ask
    } catch {
      // try again next time
    } finally {
      naming.delete(n.id);
    }
  }
}

export const useNearMisses = create<State>((set, get) => ({
  items: [],
  loaded: false,
  loading: false,
  error: null,
  lastRefresh: 0,
  load: async ({ rematch = false } = {}) => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      if (rematch || Date.now() - get().lastRefresh > REMATCH_EVERY_MS) {
        const { error } = await supabase.rpc('refresh_my_near_misses');
        if (error) console.warn('Matching failed', error.message);
        else set({ lastRefresh: Date.now() });
      }
      const { data, error } = await supabase.rpc('my_near_misses');
      if (error) throw new Error(error.message);
      const items = ((data ?? []) as RealNearMiss[]).map((n) => ({ ...n, comment_count: Number(n.comment_count), unread_count: Number(n.unread_count) }));
      set({ items, loaded: true });
      namePlaces(items, (id, name) => set({ items: get().items.map((x) => (x.id === id ? { ...x, place_name: name } : x)) }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loaded: true });
    } finally {
      set({ loading: false });
    }
  },
  markRead: (id) => {
    set({ items: get().items.map((x) => (x.id === id ? { ...x, is_new: false, unread_count: 0 } : x)) });
    supabase.rpc('mark_near_miss_read', { nm_id: id }).then(() => {}, () => {});
  },
  reset: () => set({ items: [], loaded: false, loading: false, error: null, lastRefresh: 0 }),
}));

export async function loadComments(nmId: string): Promise<NearMissComment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('id, author_id, body, created_at')
    .eq('near_miss_id', nmId)
    .order('created_at');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addComment(nmId: string, body: string): Promise<NearMissComment> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to comment.');
  const { data, error } = await supabase
    .from('comments')
    .insert({ near_miss_id: nmId, author_id: user.id, body: body.trim() })
    .select('id, author_id, body, created_at')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function giveFeedback(nmId: string, kind: 'together' | 'not_interesting' | 'hide_place') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('match_feedback').upsert({ near_miss_id: nmId, user_id: user.id, kind }, { onConflict: 'user_id,near_miss_id' });
  if (error) throw new Error(error.message);
}
