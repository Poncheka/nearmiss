import { create } from 'zustand';
import {
  Comment,
  initialComments,
  initialMet,
  initialTheyShared,
  initialUnread,
  nearMisses,
  NearMiss,
  yearOf,
} from '@/data/mock';

export type Audience = 'friends' | 'fof' | 'everyone';
export type Delay = '3d' | '1w' | '2w' | '1m';
export type NotifKey = 'photos' | 'replies' | 'joins' | 'report' | 'anniv';

type MetDate = { label: string; by: 'auto' | 'me' | 'them' };

type State = {
  // onboarding
  onboarded: boolean;
  finishOnboarding: () => void;
  addedFriends: Record<string, boolean>;
  invitesSent: Record<string, boolean>;
  // near miss interaction
  unread: Record<string, number>;
  seen: Record<string, boolean>;
  picked: Record<string, number[]>;
  shared: Record<string, boolean>;
  theyShared: Record<string, boolean>;
  comments: Record<string, Comment[]>;
  feedback: Record<string, string>;
  met: Record<string, MetDate>;
  activityRead: boolean;
  // settings
  audience: Audience;
  delay: Delay;
  backgroundLocation: boolean;
  notifs: Record<NotifKey, boolean>;

  addFriend: (id: string) => void;
  sendInvite: (id: string) => void;
  openNearMiss: (id: string) => void;
  togglePick: (id: string, index: number) => void;
  sharePicked: (id: string) => void;
  simulateTheyShare: (id: string) => void;
  addComment: (id: string, text: string) => void;
  giveFeedback: (id: string, kind: string) => void;
  setMet: (friendId: string, label: string) => void;
  markActivityRead: () => void;
  setAudience: (a: Audience) => void;
  setDelay: (d: Delay) => void;
  toggleBackgroundLocation: () => void;
  toggleNotif: (k: NotifKey) => void;
};

export const useStore = create<State>((set, get) => ({
  onboarded: false,
  finishOnboarding: () => set({ onboarded: true }),
  addedFriends: { sam: true },
  invitesSent: {},
  unread: { ...initialUnread },
  seen: {},
  picked: {},
  shared: {},
  theyShared: { ...initialTheyShared },
  comments: { ...initialComments },
  feedback: {},
  met: { ...initialMet },
  activityRead: false,
  audience: 'fof',
  delay: '3d',
  backgroundLocation: true,
  notifs: { photos: true, replies: true, joins: true, report: true, anniv: false },

  addFriend: (id) => set((s) => ({ addedFriends: { ...s.addedFriends, [id]: true } })),
  sendInvite: (id) => set((s) => ({ invitesSent: { ...s.invitesSent, [id]: true } })),
  openNearMiss: (id) => set((s) => ({ unread: { ...s.unread, [id]: 0 }, seen: { ...s.seen, [id]: true } })),
  togglePick: (id, index) =>
    set((s) => {
      if (s.shared[id]) return {};
      const cur = s.picked[id] ?? [0];
      const next = cur.includes(index) ? cur.filter((i) => i !== index) : [...cur, index];
      return { picked: { ...s.picked, [id]: next } };
    }),
  sharePicked: (id) => {
    const count = (get().picked[id] ?? [0]).length;
    if (!count) return;
    set((s) => ({ shared: { ...s.shared, [id]: true } }));
  },
  simulateTheyShare: (id) => set((s) => ({ theyShared: { ...s.theyShared, [id]: true } })),
  addComment: (id, text) =>
    set((s) => ({
      comments: {
        ...s.comments,
        [id]: [...(s.comments[id] ?? []), { id: String(Date.now()), authorId: 'jeff', when: 'Now', text }],
      },
    })),
  giveFeedback: (id, kind) => set((s) => ({ feedback: { ...s.feedback, [id]: kind } })),
  setMet: (friendId, label) => set((s) => ({ met: { ...s.met, [friendId]: { label, by: 'me' } } })),
  markActivityRead: () => set({ activityRead: true }),
  setAudience: (audience) =>
    set((s) => ({ audience, delay: audience === 'everyone' && s.delay === '3d' ? '1w' : s.delay })),
  setDelay: (delay) =>
    set((s) => (s.audience === 'everyone' && delay === '3d' ? {} : { delay })),
  toggleBackgroundLocation: () => set((s) => ({ backgroundLocation: !s.backgroundLocation })),
  toggleNotif: (k) => set((s) => ({ notifs: { ...s.notifs, [k]: !s.notifs[k] } })),
}));

// ---- derived helpers ----

export const metYear = (met: Record<string, MetDate>, friendId: string) => yearOf(met[friendId]?.label ?? '');

export const isBeforeMet = (met: Record<string, MetDate>, nm: NearMiss) => {
  const y = metYear(met, nm.friendId);
  return y !== null && nm.year < y;
};

export const yearsBeforeMet = (met: Record<string, MetDate>, nm: NearMiss) => {
  const y = metYear(met, nm.friendId);
  return y === null ? 0 : y - nm.year;
};

export const getNearMiss = (id: string) => nearMisses.find((n) => n.id === id);

export const delayLabel: Record<Delay, string> = { '3d': '3 days', '1w': '1 week', '2w': '2 weeks', '1m': '1 month' };
