// Reacting to a message or a photo.
//
// One reaction per person per thing, the way a tapback works. Tapping the same one again takes
// it back, tapping a different one swaps it. That keeps two people from building a tally on a
// photo only the two of them will ever see.
//
// Everything for a near miss loads in one call, because the thread and the carousel both need
// reactions and a request per message would be absurd.
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export type ReactionTarget = 'comment' | 'photo';

export type Reaction = {
  target_type: ReactionTarget;
  target_id: string;
  user_id: string;
  emoji: string;
  mine: boolean;
};

/** The six that cover almost everything without turning into a keyboard. */
export const EMOJI = ['❤️', '😂', '😮', '🥲', '🔥', '👀'];

type State = {
  byNearMiss: Record<string, Reaction[]>;
  load: (nearMissId: string) => Promise<void>;
  react: (nearMissId: string, target: ReactionTarget, targetId: string, emoji: string) => Promise<void>;
  reset: () => void;
};

export const useReactions = create<State>((set, get) => ({
  byNearMiss: {},

  load: async (nearMissId) => {
    const { data, error } = await supabase.rpc('near_miss_reactions', { nm_id: nearMissId });
    if (error) return;
    set({ byNearMiss: { ...get().byNearMiss, [nearMissId]: (data ?? []) as Reaction[] } });
  },

  react: async (nearMissId, target, targetId, emoji) => {
    const before = get().byNearMiss[nearMissId] ?? [];
    const mineHere = before.find((r) => r.mine && r.target_type === target && r.target_id === targetId);
    const removing = mineHere?.emoji === emoji;

    // Applied straight away. A reaction that waits for the network feels broken, and the worst
    // case is a wrong emoji for a moment before the reload puts it right.
    const without = before.filter((r) => !(r.mine && r.target_type === target && r.target_id === targetId));
    set({
      byNearMiss: {
        ...get().byNearMiss,
        [nearMissId]: removing
          ? without
          : [...without, { target_type: target, target_id: targetId, user_id: 'me', emoji, mine: true }],
      },
    });

    const { error } = await supabase.rpc('react', {
      nm_id: nearMissId, t_type: target, t_id: targetId, e: emoji,
    });
    if (error) {
      set({ byNearMiss: { ...get().byNearMiss, [nearMissId]: before } });
      throw new Error(error.message);
    }
  },

  reset: () => set({ byNearMiss: {} }),
}));

/** The reactions on one thing, and which one is yours. */
export function reactionsFor(all: Reaction[] | undefined, target: ReactionTarget, targetId: string) {
  const here = (all ?? []).filter((r) => r.target_type === target && r.target_id === targetId);
  return { list: here, mine: here.find((r) => r.mine)?.emoji ?? null };
}
