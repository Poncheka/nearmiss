// Your phone's contacts: who's already on Near Miss, and who to invite.
// Contacts never leave the phone. Only one-way fingerprints (SHA-256) of their email
// addresses are sent, and the server only answers with people who registered that address.
import { Linking, Platform, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useNearMisses } from '@/lib/nearMisses';

/** Remembers that contact matching was turned off, so a relaunch doesn't re-register you. */
const UNLINKED_KEY = 'nearmiss.contacts.unlinked';
/** Last read of the address book, so opening Search paints instantly instead of re-reading. */
const CACHE_KEY = 'nearmiss.contacts.cache.v2';
/** email -> sha256, so an address is only ever hashed once on this phone. */
const HASH_KEY = 'nearmiss.contacts.hashes.v2';

type ContactsModule = typeof import('expo-contacts');

export type PhoneContact = {
  id: string;
  name: string;
  initial: string;
  phone: string | null;   // best number to text
  email: string | null;
  thumbnail: string | null;
  /** Raw addresses, kept on the phone. Only one-way hashes of these are ever sent. */
  emails: string[];
  emailHashes: string[];
  /** False for shortcodes and nameless rows: still searchable, just not worth browsing. */
  browsable: boolean;
};

export type AppUser = { id: string; username: string | null; name: string | null; avatar_url: string | null; contactName?: string };
export type FriendStatus = 'friends' | 'requested' | 'incoming';
export type ContactsAccess = 'granted' | 'limited' | 'denied' | 'undetermined' | 'unavailable';

export const INVITE_BASE_URL = process.env.EXPO_PUBLIC_INVITE_URL ?? 'https://nearmiss.io';
export const inviteLink = (username?: string | null) => `${INVITE_BASE_URL}/i/${username || ''}`.replace(/\/i\/$/, '');
export const inviteMessage = (username?: string | null) =>
  `Hey! I just joined Near Miss. Let's find out where we might have crossed paths before we met: ${inviteLink(username)}`;

const hashOnce = (s: string) => bytesToHex(sha256(utf8ToBytes(s.trim().toLowerCase())));

/**
 * Hashing, remembered and spread out.
 *
 * SHA-256 in JavaScript is not slow, but four thousand of them in one synchronous loop locks the
 * UI thread for long enough to look broken, and it used to happen on every visit to the tab.
 * Addresses we have hashed before come from the table; the rest are done in small batches that
 * yield to the interface between them.
 */
const memo = new Map<string, string>();

async function loadHashMemo() {
  if (memo.size) return;
  try {
    const raw = await AsyncStorage.getItem(HASH_KEY);
    if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, string>)) memo.set(k, v);
  } catch { /* a cold cache just means we hash again */ }
}

const idle = () => new Promise<void>((r) => setTimeout(r, 0));

async function hashAll(emails: string[]): Promise<string[]> {
  await loadHashMemo();
  const out: string[] = [];
  let sinceBreath = 0;
  let added = false;
  for (const e of emails) {
    let h = memo.get(e);
    if (!h) {
      h = hashOnce(e);
      memo.set(e, h);
      added = true;
      if (++sinceBreath >= 200) { sinceBreath = 0; await idle(); }
    }
    out.push(h);
  }
  if (added) {
    AsyncStorage.setItem(HASH_KEY, JSON.stringify(Object.fromEntries(memo))).catch(() => {});
  }
  return out;
}

/**
 * Domains people actually sign up to a social app with.
 *
 * A work address is the one least likely to be on Near Miss, so when a contact has several, the
 * personal one is the one worth showing and the one worth trying first.
 */
const PERSONAL = /@(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|aol|icloud|me|mac|proton|protonmail|pm|hey|fastmail|gmx|zoho|mail|yandex|comcast|verizon|att|sbcglobal|cox|bellsouth|btinternet|orange|free|web|t-online)\./i;

/** Junk in an address book: shortcodes, voicemail entries, rows with no human name. */
const looksLikeJunk = (name: string, phones: string[]) => {
  if (!/\p{L}/u.test(name)) return true;                       // no letters at all
  if (/^[*#]/.test(name.trim())) return true;                   // *611, #MyAccount
  if (phones.length && phones.every((p) => /^[*#]/.test(p.trim()))) return true;
  return false;
};

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

/**
 * Reading contacts used to take many seconds on a real address book. Two reasons, both fixed:
 * THUMBNAIL made the system decode an image for every single person before returning anything,
 * and we hashed every email address up front. Names and emails are cheap, so we read those,
 * show the list, and only hash when we're about to ask the server about them.
 */
async function readContacts(): Promise<PhoneContact[]> {
  const C = lib();
  if (!C) return [];
  const F = C.ContactField;
  const rows = await C.Contact.getAllDetails([F.FULL_NAME, F.GIVEN_NAME, F.FAMILY_NAME, F.COMPANY, F.PHONES, F.EMAILS] as const);
  const out: PhoneContact[] = [];
  for (const r of rows) {
    const name = (r.fullName || [r.givenName, r.familyName].filter(Boolean).join(' ') || r.company || '').trim();
    const phones = (r.phones ?? []).map((p) => p.number?.trim()).filter((n): n is string => !!n);
    const emails = (r.emails ?? []).map((e) => e.address?.trim().toLowerCase()).filter((e): e is string => !!e && e.includes('@'));
    if (!name || (phones.length === 0 && emails.length === 0)) continue;
    const mobile = (r.phones ?? []).find((p) => /mobile|iphone|cell/i.test(p.label ?? ''))?.number ?? phones[0] ?? null;
    // Show the personal address when there is one. Every address is still matched; this only
    // decides which one is displayed and which one an email invite would go to.
    const shown = emails.find((e) => PERSONAL.test(e)) ?? emails[0] ?? null;
    out.push({
      id: r.id,
      name,
      initial: name.charAt(0).toUpperCase(),
      phone: mobile,
      email: shown,
      thumbnail: null,
      emails,
      emailHashes: [],
      browsable: !looksLikeJunk(name, phones),
    });
  }
  // Textable people first. An invite that opens Messages gets read; one that opens Mail mostly
  // does not, so the people you can actually reach lead the list. Alphabetical within each group.
  return out.sort((a, b) => {
    if (!!a.phone !== !!b.phone) return a.phone ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
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
  /** True once the on-disk cache has been consulted, whether or not it had anything. */
  hydrated: boolean;
  /** Show the previous read immediately, before touching the address book again. */
  hydrate: () => Promise<void>;
  load: (ask?: boolean) => Promise<void>;
  refreshFriends: () => Promise<void>;
  addFriend: (id: string) => Promise<FriendStatus>;
  /** True once contact matching has been turned off on this account. */
  unlinked: boolean;
  /** Stop being findable by phone or email, and forget the address book held here. */
  unlink: () => Promise<void>;
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
  unlinked: false,
  hydrated: false,
  checkAccess: async () => {
    // Remembered across launches, so unlinking survives a restart.
    try { if (await AsyncStorage.getItem(UNLINKED_KEY)) set({ unlinked: true }); } catch { /* ignore */ }
    set({ access: await getContactsAccess().catch(() => 'unavailable' as const) });
  },

  /**
   * Paint from the last read, immediately.
   *
   * The tab used to re-read the whole address book across the native bridge on every focus, then
   * hash every address, before showing anything. This puts the previous answer on screen while
   * the fresh read happens behind it, which is the difference between "instant" and "stuck".
   */
  hydrate: async () => {
    if (get().contacts.length || get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) { set({ hydrated: true }); return; }
      const cached = JSON.parse(raw) as { contacts: PhoneContact[]; onApp: AppUser[] };
      // Only if nothing arrived while we were reading from disk.
      if (!get().contacts.length) set({ contacts: cached.contacts ?? [], onApp: cached.onApp ?? [] });
    } catch { /* a bad cache is just a slow first paint */ }
    set({ hydrated: true });
  },
  load: async (ask = false) => {
    if (get().loading) return;
    // 'loading' drives a spinner, but only when there is nothing to look at yet. A refresh
    // behind a list that is already on screen should be silent.
    set({ loading: true, error: null });
    try {
      // Make sure people who have your email in their contacts can find you. Skipped once you
      // have unlinked, otherwise the next refresh would quietly put you back.
      if (!get().unlinked) supabase.rpc('register_my_contact_hashes').then(() => {}, () => {});
      let access = await getContactsAccess();
      if (ask && (access === 'undetermined' || access === 'denied')) access = await requestContactsAccess();
      set({ access });
      await get().refreshFriends();
      if (access !== 'granted' && access !== 'limited') return;

      const contacts = await readContacts();
      // Render the list straight away; matching is a network round trip and can catch up.
      set({ contacts, loading: false });

      const hashes = [...new Set(await hashAll(contacts.flatMap((c) => c.emails)))];
      const found = new Map<string, AppUser>();
      for (let i = 0; i < hashes.length; i += 2000) {
        const { data, error } = await supabase.rpc('find_contacts_on_app', { hashes: hashes.slice(i, i + 2000) });
        if (error) throw new Error(error.message);
        for (const u of (data ?? []) as AppUser[]) found.set(u.id, u);
      }
      const onApp = [...found.values()].sort((a, b) => (a.name ?? a.username ?? '').localeCompare(b.name ?? b.username ?? ''));
      set({ onApp });
      // Next time this tab opens, it opens on this.
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ contacts, onApp })).catch(() => {});
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
  unlink: async () => {
    const { error } = await supabase.rpc('unlink_my_contacts');
    if (error) throw new Error(error.message);
    // Now that the last read is cached on disk, forgetting has to reach that too, or the
    // promise on the Contacts screen would be false the moment the app restarted.
    AsyncStorage.multiRemove([CACHE_KEY, HASH_KEY]).catch(() => {});
    memo.clear();
    // The address book copy lives only in this store, so dropping it is the whole of the
    // on-device half. The operating system permission is the person's to revoke, in Settings.
    set({ contacts: [], onApp: [], unlinked: true });
    await AsyncStorage.setItem(UNLINKED_KEY, '1').catch(() => {});
  },

  reset: () => {
    // onApp is about this account, not this phone: leaving it cached would show the next person
    // to sign in on this handset a flash of the previous person's matches.
    //
    // The hash table goes too, and this is the part that was wrong. Its keys are the addresses
    // and numbers themselves, in the clear, so it is a copy of the address book that was
    // outliving the account it was read for: sign out, or delete the account outright, and it
    // stayed on disk for whoever signed in next. unlink() always cleared both. Signing out now
    // does the same. The cost is that the next sign-in hashes the address book again, which is
    // a few seconds of work we should be paying.
    AsyncStorage.multiRemove([CACHE_KEY, HASH_KEY]).catch(() => {});
    memo.clear();
    set({ access: null, loading: false, error: null, contacts: [], onApp: [], statuses: {}, friends: [], hydrated: false });
  },
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
