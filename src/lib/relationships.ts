// Leaving, and keeping someone away.
//
// This app tells people where you have been, so ending it has to actually remove what they can
// see rather than change a label. Both paths delete the friendship and every near miss between
// you, along with the comments and photos on them.
//
// Unfriend is the ordinary one. Either of you can ask again afterwards.
//
// Block is the safety one: the same erasure, plus a record that stops friend requests, username
// search, contact matching and matching itself. Only the person who blocked can undo it, and the
// blocked person is never told.
import { supabase } from '@/lib/supabase';

const BUCKET = 'shared-photos';

export type BlockedPerson = {
  user_id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
};

/**
 * Deletes the photo files the two of you shared.
 *
 * The database can't do this part: Supabase refuses plain SQL deletes against storage, so the
 * rows cascade away server-side and the files have to go from here, before the near misses that
 * point at them are gone. Failures are swallowed on purpose. An orphaned file is a far better
 * outcome than an unfriend that doesn't complete.
 */
async function removeSharedFiles(other: string) {
  try {
    const { data: rows } = await supabase
      .from('shared_photos')
      .select('storage_path, near_miss_id, near_misses!inner(user_a, user_b)')
      .or(`user_a.eq.${other},user_b.eq.${other}`, { foreignTable: 'near_misses' });
    const paths = (rows ?? []).map((r) => (r as { storage_path: string }).storage_path);
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  } catch {
    // Nothing here is worth blocking the unfriend on.
  }
}

/** Ends the friendship and removes everything between you. They can ask again. */
export async function unfriend(other: string) {
  await removeSharedFiles(other);
  const { error } = await supabase.rpc('unfriend', { other });
  if (error) throw new Error(error.message);
}

/** The same, plus they can no longer find you, reach you, or be matched with you. */
export async function blockUser(other: string) {
  await removeSharedFiles(other);
  const { error } = await supabase.rpc('block_user', { other });
  if (error) throw new Error(error.message);
}

/** Lets them find you again. Nothing that was deleted comes back. */
export async function unblockUser(other: string) {
  const { error } = await supabase.rpc('unblock_user', { other });
  if (error) throw new Error(error.message);
}

export async function myBlocks(): Promise<BlockedPerson[]> {
  const { data, error } = await supabase.rpc('my_blocks');
  if (error) return [];
  return (data ?? []) as BlockedPerson[];
}

export type PublicProfile = {
  id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
};

export type FriendOf = {
  user_id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
  /** 'all' when you are their friend, 'mutual' when you are only seeing the overlap. */
  scope: 'all' | 'mutual';
};

/**
 * The few fields a stranger's profile needs.
 *
 * Row-level security only lets you read profiles of friends and people you have a near miss
 * with, which is right, but it means someone you just found by username has no readable row.
 * This returns the same four fields username search already gives back, and nothing more.
 */
export async function publicProfile(id: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc('public_profile', { uid: id });
  if (error) return null;
  const rows = (data ?? []) as PublicProfile[];
  return rows[0] ?? null;
}

/**
 * Who they know, as much of it as you are entitled to see.
 *
 * Friends see the whole list. Everyone else sees only the people you both know, which is the
 * part that helps you work out whether this is the right person. The scope comes back with the
 * rows so the screen can say which it is showing instead of implying it is everyone.
 */
export async function friendsOf(id: string): Promise<FriendOf[]> {
  const { data, error } = await supabase.rpc('friends_of', { uid: id });
  if (error) return [];
  return (data ?? []) as FriendOf[];
}
