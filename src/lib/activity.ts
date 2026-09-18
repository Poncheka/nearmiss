// What's happened lately: friend requests, accepts, and comments on your near misses.
// The rows are written by database triggers, so anything here really happened.
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export type ActivityKind = 'friend_request' | 'friend_accepted' | 'comment';

export type RealActivity = {
  id: string;
  type: ActivityKind;
  actor_id: string | null;
  actor_name: string | null;
  actor_username: string | null;
  actor_avatar_url: string | null;
  near_miss_id: string | null;
  place_name: string | null;
  night: string | null;
  body: string | null;
  created_at: string;
  read_at: string | null;
};

type State = {
  items: RealActivity[];
  unread: number;
  loaded: boolean;
  loading: boolean;
  load: () => Promise<void>;
  refreshUnread: () => Promise<void>;
  markAllRead: () => Promise<void>;
  reset: () => void;
};

export const actorName = (a: Pick<RealActivity, 'actor_name' | 'actor_username'>) =>
  a.actor_name?.split(' ')[0] || (a.actor_username ? `@${a.actor_username}` : 'Someone');

/** The sentence after the name, e.g. "Leigh" + "wants to be friends". */
export function activityText(a: RealActivity): string {
  switch (a.type) {
    case 'friend_request': return 'wants to be friends';
    case 'friend_accepted': return 'accepted your friend request';
    case 'comment': return a.place_name ? `commented on ${a.place_name.split(',')[0]}` : 'commented on a near miss';
    default: return 'did something';
  }
}

export function activityWhen(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const useActivity = create<State>((set, get) => ({
  items: [],
  unread: 0,
  loaded: false,
  loading: false,
  load: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const { data, error } = await supabase.rpc('my_activity', { limit_n: 100 });
      if (error) throw new Error(error.message);
      const items = (data ?? []) as RealActivity[];
      set({ items, loaded: true, unread: items.filter((i) => !i.read_at).length });
    } catch (e) {
      console.warn('Loading activity failed', e);
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },
  refreshUnread: async () => {
    const { data, error } = await supabase.rpc('my_unread_activity');
    if (!error) set({ unread: Number(data ?? 0) });
  },
  markAllRead: async () => {
    const now = new Date().toISOString();
    set({ unread: 0, items: get().items.map((i) => (i.read_at ? i : { ...i, read_at: now })) });
    await supabase.rpc('mark_activity_read').then(() => {}, () => {});
  },
  reset: () => set({ items: [], unread: 0, loaded: false, loading: false }),
}));
