// What's happened lately: friend requests, accepts, and comments on your near misses.
// The rows are written by database triggers, so anything here really happened.
import { create } from 'zustand';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';

export type ActivityKind = 'friend_request' | 'friend_accepted' | 'comment' | 'near_miss' | 'photo_shared' | 'met_changed' | 'reaction' | 'nudge';

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
  /** The message or photo this is about, so opening it can land on the right thing. */
  target_id: string | null;
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
  /** Opening one should clear it, not leave it bold. */
  markOneRead: (id: string) => Promise<void>;
  reset: () => void;
};

/**
 * Keep the red number on the app icon honest.
 *
 * The push payload sets it when a notification arrives, and nothing was ever clearing it, so it
 * only ever climbed. Forty eight unread on an icon whose list says everything is read is the
 * kind of thing that gets an app deleted. Every path that changes the unread count sets the
 * badge to match, including to zero.
 */
function syncBadge(n: number) {
  Notifications.setBadgeCountAsync(Math.max(0, n)).catch(() => {});
}

export const actorName = (a: Pick<RealActivity, 'actor_name' | 'actor_username'>) =>
  a.actor_name?.split(' ')[0] || (a.actor_username ? `@${a.actor_username}` : 'Someone');

/** The sentence after the name, e.g. "Leigh" + "wants to be friends". */
export function activityText(a: RealActivity): string {
  switch (a.type) {
    case 'friend_request': return 'wants to be friends';
    case 'friend_accepted': return 'accepted your friend request';
    case 'comment': return a.place_name ? `commented on ${a.place_name.split(',')[0]}` : 'commented on a near miss';
    // Deliberately no count: matching a new friend can add dozens at once, and any number
    // we wrote here would be wrong by the time it was read.
    case 'near_miss': return 'and you have new near misses';
    case 'photo_shared': return a.place_name ? `shared a photo from ${a.place_name.split(',')[0]}` : 'shared a photo from that day';
    // Worth telling them: this is what moves near misses between "before you met" and the rest,
    // so their feed rearranges itself and otherwise there is nothing to explain why.
    case 'met_changed': return 'set when you two met';
    // The emoji itself is the message, so it goes in the line rather than being described.
    case 'reaction': return a.body ? `reacted ${a.body}` : 'reacted to something of yours';
    // Says what it is for, not just that it happened. "Nudged you" on its own reads as a poke
    // with no obvious response; this one names the thing to do.
    case 'nudge': return 'is waiting on your photos';
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
      const unread = items.filter((i) => !i.read_at).length;
      set({ items, loaded: true, unread });
      syncBadge(unread);
    } catch (e) {
      console.warn('Loading activity failed', e);
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },
  refreshUnread: async () => {
    const { data, error } = await supabase.rpc('my_unread_activity');
    if (!error) {
      const unread = Number(data ?? 0);
      set({ unread });
      syncBadge(unread);
    }
  },
  markAllRead: async () => {
    const now = new Date().toISOString();
    set({ unread: 0, items: get().items.map((i) => (i.read_at ? i : { ...i, read_at: now })) });
    syncBadge(0);
    await supabase.rpc('mark_activity_read').then(() => {}, () => {});
  },
  markOneRead: async (id) => {
    const item = get().items.find((i) => i.id === id);
    if (!item || item.read_at) return;
    const now = new Date().toISOString();
    set({
      items: get().items.map((i) => (i.id === id ? { ...i, read_at: now } : i)),
      unread: Math.max(0, get().unread - 1),
    });
    syncBadge(get().unread);
    await supabase.rpc('mark_activity_read_one', { a_id: id });
  },

  reset: () => {
    syncBadge(0);
    set({ items: [], unread: 0, loaded: false, loading: false });
  },
}));
