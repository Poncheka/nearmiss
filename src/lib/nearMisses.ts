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
  kind: 'crossed' | 'same_place';
  overlap_min: number | null;
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

/** A friend we found near misses with, but don't know when you two met. */
export type NeedsMetOn = {
  friend_id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  near_miss_count: number;
  earliest: string;
  /** Our guess at when they met: the first night that starts a cluster. Null if we can't tell. */
  guess: string | null;
};

type State = {
  items: RealNearMiss[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  lastRefresh: number;
  /** Friends we should ask "when did you two meet?" about. */
  needsMetOn: NeedsMetOn[];
  load: (opts?: { rematch?: boolean }) => Promise<void>;
  loadNeedsMetOn: () => Promise<void>;
  setMetOn: (friendId: string, date: string | null) => Promise<void>;
  markRead: (id: string) => void;
  reset: () => void;
};

const REMATCH_EVERY_MS = 10 * 60 * 1000;

export const otherName = (n: Pick<RealNearMiss, 'other_name' | 'other_username'>) =>
  n.other_name?.split(' ')[0] || (n.other_username ? `@${n.other_username}` : 'A friend');

export const placeLabel = (n: Pick<RealNearMiss, 'place_name'>) => n.place_name || 'Somewhere nearby';

/**
 * "crossed" means you were there at the same time. "same_place" means the same night,
 * within a few hundred metres, but hours apart. Both are worth seeing; they read differently.
 */
export const nearLabel = (n: Pick<RealNearMiss, 'kind' | 'distance_m' | 'overlap_min'>) => {
  if (n.kind === 'crossed') return `${n.distance_m}m apart`;
  const apart = Math.abs(n.overlap_min ?? 0);
  if (apart >= 90) return `${Math.round(apart / 60)} hours apart`;
  if (apart >= 10) return `${Math.round(apart / 5) * 5} minutes apart`;
  return 'Just missed';
};

export const kindLabel = (n: Pick<RealNearMiss, 'kind'>) =>
  n.kind === 'crossed' ? 'Same time' : 'Same night';

export const formatWhen = (iso: string) => {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    short: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase(),
    year: d.getFullYear(),
  };
};

const midpoint = (n: RealNearMiss) => ({ lat: (n.my_lat + n.their_lat) / 2, lng: (n.my_lng + n.their_lng) / 2 });

/**
 * Asks the server for the actual venue — "Balthazar" rather than "SoHo, New York".
 *
 * The Foursquare key lives in an Edge Function secret, so this is a round trip rather than a
 * call from the phone. Returns what it could name; anything it couldn't falls through to
 * Apple below. If the key isn't set yet, or the function is having a bad day, it returns
 * nothing and the app behaves exactly as it did before.
 */
async function nameFromVenues(items: RealNearMiss[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!items.length) return out;
  try {
    const points = items.map((n) => ({ id: n.id, ...midpoint(n) }));
    const { data, error } = await supabase.functions.invoke('place-name', { body: { points } });
    if (error) return out;
    for (const p of (data?.places ?? []) as { id: string; name: string }[]) {
      if (p?.id && p?.name) out.set(p.id, p.name);
    }
  } catch {
    // Offline, or the function isn't reachable. Apple's names are a fine second best.
  }
  return out;
}

// Names the places a near miss happened, then saves each one for both people.
const naming = new Set<string>();
async function namePlaces(items: RealNearMiss[], update: (id: string, name: string) => void) {
  if (Platform.OS === 'web') return;
  let Location: typeof import('expo-location');
  try { Location = require('expo-location'); } catch { return; }
  // 25 is what the place-name function takes in one request; the phone-side fallback is the
  // slow part, and it only runs for whatever Foursquare couldn't name.
  const todo = items.filter((n) => !n.place_name && !naming.has(n.id)).slice(0, 25);
  if (!todo.length) return;

  // Venues first, in one request for the whole batch.
  todo.forEach((n) => naming.add(n.id));
  let venues = new Map<string, string>();
  try {
    venues = await nameFromVenues(todo);
    for (const [id, name] of venues) {
      update(id, name);
      await supabase.rpc('set_near_miss_place', { nm_id: id, name });
    }
  } finally {
    todo.forEach((n) => naming.delete(n.id));
  }

  // Whatever Foursquare didn't know: the neighbourhood, from the phone.
  for (const n of todo.filter((x) => !venues.has(x.id))) {
    naming.add(n.id);
    try {
      const { lat, lng } = midpoint(n);
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
  needsMetOn: [],
  loadNeedsMetOn: async () => {
    const { data, error } = await supabase.rpc('friendships_needing_met_on');
    if (error) return;
    set({ needsMetOn: ((data ?? []) as NeedsMetOn[]).map((n) => ({ ...n, near_miss_count: Number(n.near_miss_count) })) });
  },
  setMetOn: async (friendId, date) => {
    const { error } = await supabase.rpc('set_met_on', { friend: friendId, on_date: date });
    if (error) throw new Error(error.message);
    // The server relabels every near miss for the pair, so pull them again.
    set({ needsMetOn: get().needsMetOn.filter((n) => n.friend_id !== friendId) });
    const { data } = await supabase.rpc('my_near_misses');
    if (data) set({ items: (data as RealNearMiss[]).map((n) => ({ ...n, comment_count: Number(n.comment_count), unread_count: Number(n.unread_count) })) });
  },
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
      get().loadNeedsMetOn();
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
  reset: () => set({ items: [], loaded: false, loading: false, error: null, lastRefresh: 0, needsMetOn: [] }),
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
