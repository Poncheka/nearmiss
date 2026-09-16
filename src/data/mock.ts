// Sample data for the clickable build. Replaced by Supabase in step 2.
import { colors, pastel } from '@/theme';

export type Person = {
  id: string;
  name: string;
  fullName: string;
  handle: string;
  initial: string;
  color: string;
  mutuals: number;
  friendsSince?: string;
};

export const me: Person = {
  id: 'jeff',
  name: 'Jeff',
  fullName: 'Jeff',
  handle: '@jeff',
  initial: 'J',
  color: pastel.lilac,
  mutuals: 0,
};

export const people: Record<string, Person> = {
  maya: { id: 'maya', name: 'Maya', fullName: 'Maya R.', handle: '@maya', initial: 'M', color: pastel.peach, mutuals: 3, friendsSince: 'Sep 14' },
  sam: { id: 'sam', name: 'Sam', fullName: 'Sam T.', handle: '@sam', initial: 'S', color: pastel.sage, mutuals: 5, friendsSince: 'Sep 2' },
  priya: { id: 'priya', name: 'Priya', fullName: 'Priya S.', handle: '@priya', initial: 'P', color: pastel.butter, mutuals: 1, friendsSince: 'Sep 9' },
  leo: { id: 'leo', name: 'Leo', fullName: 'Leo K.', handle: '@leo', initial: 'L', color: pastel.sky, mutuals: 2 },
};

export type NearMiss = {
  id: string;
  friendId: string;
  place: string;
  placeFull: string;
  dateShort: string;
  dateLong: string;
  time: string;
  timeRange: string;
  year: number;
  distance: number;
  viaFriendId?: string;
  isNew?: boolean;
  revealLine?: string;
  prompt: string;
};

export const nearMisses: NearMiss[] = [
  {
    id: 'dolores', friendId: 'maya', place: 'Dolores Park', placeFull: 'Dolores Park, SF',
    dateShort: 'Jul 17, 2021', dateLong: 'Sat, Jul 17, 2021', time: '3:20pm', timeRange: '3:05 to 3:35pm', year: 2021, distance: 80, isNew: true,
    revealLine: 'Two years after you met. Opposite ends of the park, and neither of you knew.',
    prompt: 'which side of the park were you on?',
  },
  {
    id: 'bluebottle', friendId: 'leo', place: 'Blue Bottle, Hayes Valley', placeFull: 'Blue Bottle, Hayes Valley',
    dateShort: 'Mar 2, 2025', dateLong: 'Sun, Mar 2, 2025', time: '8:05am', timeRange: '7:55 to 8:20am', year: 2025, distance: 45, viaFriendId: 'sam', isNew: true,
    prompt: 'what did you order?',
  },
  {
    id: 'les', friendId: 'sam', place: 'Lower East Side, New York', placeFull: 'Lower East Side, New York',
    dateShort: 'Oct 3, 2024', dateLong: 'Thu, Oct 3, 2024', time: '11:48pm', timeRange: '11:30pm to 12:10am', year: 2024, distance: 90,
    prompt: 'what were you doing in New York?',
  },
  {
    id: 'sfo', friendId: 'priya', place: 'SFO Terminal 2', placeFull: 'SFO Terminal 2',
    dateShort: 'Jan 8, 2023', dateLong: 'Sun, Jan 8, 2023', time: '7:05am', timeRange: '6:50 to 7:20am', year: 2023, distance: 35,
    prompt: 'where were you flying?',
  },
  {
    id: 'outsidelands', friendId: 'sam', place: 'Outside Lands', placeFull: 'Outside Lands, Golden Gate Park',
    dateShort: 'Aug 10, 2019', dateLong: 'Sat, Aug 10, 2019', time: '6:12pm', timeRange: '5:50 to 6:30pm', year: 2019, distance: 60,
    prompt: 'which stage were you at?',
  },
  {
    id: 'tartine', friendId: 'maya', place: 'Tartine, Mission', placeFull: 'Tartine, Mission District',
    dateShort: 'May 20, 2018', dateLong: 'Sun, May 20, 2018', time: '10:12am', timeRange: '9:55 to 10:30am', year: 2018, distance: 50,
    revealLine: 'Same brunch line, one Sunday morning. A year before you met.',
    prompt: 'what did you get?',
  },
  {
    id: 'fillmore', friendId: 'maya', place: 'The Fillmore', placeFull: 'The Fillmore, San Francisco',
    dateShort: 'Mar 4, 2016', dateLong: 'Fri, Mar 4, 2016', time: '9:41pm', timeRange: '9:20 to 9:50pm', year: 2016, distance: 22,
    revealLine: 'Same show. You were by the soundboard, Maya was up in the balcony.',
    prompt: 'were you there for the encore?',
  },
];

export const lockedMisses = [
  { id: 'coachella', place: 'Coachella, Indio', when: 'Apr 2022', distance: 40 },
  { id: 'jfk', place: 'JFK Terminal 4', when: 'Dec 2021', distance: 15 },
];

export type Comment = { id: string; authorId: string; when: string; text: string };

export const initialComments: Record<string, Comment[]> = {
  fillmore: [
    { id: 'c1', authorId: 'maya', when: 'Tue', text: 'WAIT. I was up in the balcony with my sister. Did you stay for the encore??' },
    { id: 'c2', authorId: 'jeff', when: 'Tue', text: 'We were right by the soundboard. Left before the encore to beat the crowd' },
  ],
};

// Unread activity per near miss (sample)
export const initialUnread: Record<string, number> = { fillmore: 2 };

// Friend already shared a photo with you on these near misses (sample)
export const initialTheyShared: Record<string, boolean> = { fillmore: true };

export const initialMet: Record<string, { label: string; by: 'auto' | 'me' | 'them' }> = {
  maya: { label: 'Jun 2019', by: 'them' },
  sam: { label: 'Sep 2020', by: 'auto' },
  priya: { label: 'Feb 2021', by: 'auto' },
  leo: { label: 'Not yet', by: 'auto' },
};

export const contactsOnApp = ['maya', 'sam', 'priya'];

export const inviteContacts = [
  { id: 'marcus', name: 'Marcus L.', count: 3, initial: 'M', color: pastel.peach },
  { id: 'dana', name: 'Dana K.', count: 2, initial: 'D', color: pastel.sky },
  { id: 'ellie', name: 'Ellie W.', count: 1, initial: 'E', color: pastel.sage },
  { id: 'noah', name: 'Noah B.', count: 1, initial: 'N', color: pastel.butter },
  { id: 'ana', name: 'Ana G.', count: 0, initial: 'A', color: pastel.lilac },
  { id: 'chris', name: 'Chris P.', count: 0, initial: 'C', color: pastel.sky },
];

export type ActivityItem = {
  id: string;
  personId: string | 'app';
  kind: 'photo' | 'reply' | 'join' | 'report' | 'date' | 'fof';
  who: string;
  text: string;
  quote?: string;
  when: string;
  action?: string;
  href: string;
  fresh?: boolean;
};

export const activity: ActivityItem[] = [
  { id: 'a1', personId: 'maya', kind: 'photo', who: 'Maya', text: 'shared a photo from The Fillmore, Mar 2016', when: '2h', action: 'Share one back', href: '/near-miss/fillmore', fresh: true },
  { id: 'a2', personId: 'maya', kind: 'reply', who: 'Maya', text: 'replied on The Fillmore', quote: 'WAIT. I was up in the balcony with my sister. Did you stay for the encore??', when: '3h', href: '/near-miss/fillmore', fresh: true },
  { id: 'a3', personId: 'leo', kind: 'fof', who: 'Leo', text: '(a friend of Sam) almost crossed paths with you at Blue Bottle', when: '1d', href: '/near-miss/bluebottle', fresh: true },
  { id: 'a4', personId: 'app', kind: 'report', who: 'Your weekly report:', text: '2 new near misses, with Maya and Leo', when: 'Sun', href: '/' },
  { id: 'a5', personId: 'maya', kind: 'date', who: 'Maya', text: 'set when you met to Jun 2019', when: 'Mon', href: '/friend/maya' },
  { id: 'a6', personId: 'maya', kind: 'join', who: 'Maya', text: 'joined Near Miss. You two almost met 3 times.', when: 'Mon', action: 'See them', href: '/reveal' },
  { id: 'a7', personId: 'priya', kind: 'join', who: 'Priya', text: 'joined from your invite', when: 'Sep 9', href: '/friend/priya' },
];

export const activityBadge: Record<ActivityItem['kind'], string> = {
  photo: colors.violet,
  reply: colors.violet,
  join: colors.coral,
  report: colors.ink,
  date: colors.muted,
  fof: colors.greenText,
};

// Stand-in photo colors (dark, concert-like)
export const myPhotoColors = ['#3A2F4A', '#2E3A4A', '#4A2F36', '#2F4A40', '#44392A'];
export const theirPhotoColors = ['#4A3A2A', '#2A3F4A', '#3F2A4A'];

export const yearOf = (label: string): number | null => {
  const m = label.match(/(19|20)\d\d/);
  return m ? Number(m[0]) : null;
};
