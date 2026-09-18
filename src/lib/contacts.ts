// Your phone's contacts: who's already on Near Miss, and who to invite.
// Contacts never leave the phone. Only one-way fingerprints (SHA-256) of their email
// addresses are sent, and the server only answers with people who registered that address.
import { Linking, Platform, Share } from 'react-native';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useNearMisses } from '@/lib/nearMisses';

type ContactsModule = typeof import('expo-contacts');

export type PhoneContact = {
  id: string;
  name: string;
  initial: string;
  phone: string | null;   // best number to text
  email: string | null;
  thumbnail: string | null;
  emailHashes: string[];
};

export type AppUser = { id: string; username: string | null; name: string | null; avatar_url: string | null; contactName?: string };
export type FriendStatus = 'friends' | 'requested' | 'incoming';
export type ContactsAccess = 'granted' | 'limited' | 'denied' | 'undetermined' | 'unavailable';

export const INVITE_BASE_URL = process.env.EXPO_PUBLIC_INVITE_URL ?? 'https://nearmiss.io';
export const inviteLink = (username?: string | null) => `${INVITE_BASE_URL}/i/${username || ''}`.replace(/\/i\/$/, '');
export const inviteMessage = (username?: string | null) =>
  `Hey! I just joined Near Miss. Let's find out where we might have crossed paths before we met: ${inviteLink(username)}`;

const hash = (s: string) => bytesToHex(sha256(utf8ToBytes(s.trim().toLowerCase())));

function lib(): ContactsModule | null {
  if (Platform.OS === 'web') return null;
  try {
    return require('expo-contacts') as ContactsModule;
  } catch {
    return null;
  }
}

const toAccess = (p: { granted: boolean; status: string; accessPrivileges?: string }): ContactsAccess =>
  p.accessPrivileges === 'limited' ? 'limited' : p.granted ? 'granted' : p.status === 'undetermined' ? 'undetermined' : 'denied';

export async function getContactsAccess(): Promise<ContactsAccess> {
  const C = lib();
  if (!C) return 'unavailable';
  return toAccess(await C.getPermissionsAsync());
}

export async function requestContactsAccess(): Promise<ContactsAccess> {
  const C = lib();
  if (!C) return 'unavailable';
  return toAccess(await C.requestPermissionsAsync());
}

async function readContacts(): Promise<PhoneContact[]> {
  const C = lib();
  if (!C) return [];
  const F = C.ContactField;
  const rows = await C.Contact.getAllDetails([F.FULL_NAME, F.GIVEN_NAME, F.FAMILY_NAME, F.COMPANY, F.PHONES, F.EMAILS, F.THUMBNAIL] as const);
  const out: PhoneContact[] = [];
  for (const r of rows) {
    const name = (r.fullName || [r.givenName, r.familyName].filter(Boolean).join(' ') || r.company || '').trim();
    const phones = (r.phones ?? []).map((p) => p.number?.trim()).filter((n): n is string => !!n);
    const emails = (r.emails ?? []).map((e) => e.address?.trim().toLowerCase()).filter((e): e is string => !!e && e.includes('@'));
    if (!name || (phones.length === 0 && emails.length === 0)) continue;
    const mobile = (r.phones ?? []).find((p) => /mobile|iphone|cell/i.test(p.label ?? ''))?.number ?? phones[0] ?? null;
    out.push({
      id: r.id,
      name,
      initial: name.charAt(0).toUpperCase(),
      phone: mobile,
      email: emails[0] ?? null,
      thumbnail: r.thumbnail ?? null,
      emailHashes: emails.map(hash),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

type ContactsState = {
  access: ContactsAccess | null;
  loading: boolean;
  error: string | null;
  contacts: PhoneContact[];
  onApp: AppUser[];            // contacts who are on Near Miss
  statuses: Record<string, FriendStatus>;
  friends: AppUser[];          // everyone you have a friendship row with
  checkAccess: () => Promise<void>;
  load: (ask?: boolean) => Promise<void>;
  refreshFriends: () => Promise<void>;
  addFriend: (id: string) => Promise<FriendStatus>;
  reset: () => void;
};

export const useContacts = create<ContactsState>((set, get) => ({
  access: null,
  loading: false,
  error: null,
  contacts: [],
  onApp: [],
  statuses: {},
  friends: [],
  checkAccess: async () => {
    set({ access: await getContactsAccess().catch(() => 'unavailable' as const) });
  },
  load: async (ask = false) => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      // Make sure people who have your email in their contacts can find you.
      supabase.rpc('register_my_contact_hashes').then(() => {}, () => {});
      let access = await getContactsAccess();
      if (ask && (access === 'undetermined' || access === 'denied')) access = await requestContactsAccess();
      set({ access });
      await get().refreshFriends();
      if (access !== 'granted' && access !== 'limited') return;

      const contacts = await readContacts();
      const byHash = new Map<string, string>();
      for (const c of contacts) for (const h of c.emailHashes) byHash.set(h, c.name);
      const hashes = [...byHash.keys()];
      const found = new Map<string, AppUser>();
      for (let i = 0; i < hashes.length; i += 2000) {
        const { data, error } = await supabase.rpc('find_contacts_on_app', { hashes: hashes.slice(i, i + 2000) });
        if (error) throw new Error(error.message);
        for (const u of (data ?? []) as AppUser[]) found.set(u.id, u);
      }
      set({ contacts, onApp: [...found.values()].sort((a, b) => (a.name ?? a.username ?? '').localeCompare(b.name ?? b.username ?? '')) });
    } catch (e) {
      console.warn('Loading contacts failed', e);
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ loading: false });
    }
  },
  refreshFriends: async () => {
    const { data, error } = await supabase.rpc('my_friendships');
    if (error) return;
    const statuses: Record<string, FriendStatus> = {};
    const friends: AppUser[] = [];
    for (const f of (data ?? []) as { friend_id: string; status: string; requested_by_me: boolean; username: string | null; name: string | null; avatar_url: string | null }[]) {
      statuses[f.friend_id] = f.status === 'accepted' ? 'friends' : f.requested_by_me ? 'requested' : 'incoming';
      friends.push({ id: f.friend_id, username: f.username, name: f.name, avatar_url: f.avatar_url });
    }
    set({ statuses, friends });
  },
  addFriend: async (id) => {
    const { data, error } = await supabase.rpc('add_friend', { target: id });
    if (error) throw new Error(error.message);
    const status = data as FriendStatus;
    set({ statuses: { ...get().statuses, [id]: status } });
    get().refreshFriends();
    if (status === 'friends') useNearMisses.getState().load({ rematch: true });
    return status;
  },
  reset: () => set({ access: null, loading: false, error: null, contacts: [], onApp: [], statuses: {}, friends: [] }),
}));

/** Find someone by their exact @username (for adding a friend who isn't in your contacts). */
export async function findByUsername(handle: string): Promise<AppUser | null> {
  const clean = handle.trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9_.]{3,24}$/.test(clean)) return null;
  const { data, error } = await supabase.rpc('find_user_by_username', { handle: clean });
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0] as AppUser | undefined;
  return row ?? null;
}

/** iOS 18+ "limited" contacts: let the person pick more. */
export async function chooseMoreContacts() {
  const C = lib();
  if (!C) return;
  try { await C.Contact.presentAccessPicker(); } catch { /* not available */ }
  await useContacts.getState().load();
}

/** Opens Messages with the invite ready to send (or Mail, or the share sheet). */
export async function sendInvite(c: Pick<PhoneContact, 'phone' | 'email'> | null, username?: string | null) {
  const body = inviteMessage(username);
  if (c?.phone) {
    const num = c.phone.replace(/[^\d+]/g, '');
    const url = Platform.OS === 'ios' ? `sms:${num}&body=${encodeURIComponent(body)}` : `sms:${num}?body=${encodeURIComponent(body)}`;
    try { await Linking.openURL(url); return; } catch { /* fall through */ }
  }
  if (c?.email) {
    const url = `mailto:${c.email}?subject=${encodeURIComponent('Where did we almost meet?')}&body=${encodeURIComponent(body)}`;
    try { await Linking.openURL(url); return; } catch { /* fall through */ }
  }
  await Share.share({ message: body }).catch(() => {});
}
