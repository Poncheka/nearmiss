// Sharing a photo or clip from the day you nearly met.
//
// This is the one place a photo leaves the phone, and it only happens because someone picked
// that photo and tapped share. The file goes to a private bucket under
// <near_miss_id>/<owner_id>/<file>; database policies only let the two people in that near
// miss read it, so a link is useless to anyone else. Everything is read back through short
// signed URLs rather than being public.
import { Platform } from 'react-native';
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

const BUCKET = 'shared-photos';
const SIGNED_FOR = 60 * 60; // an hour is plenty for a screen that's open
const MAX_BYTES = 50 * 1024 * 1024;

export type SharedPhoto = {
  id: string;
  owner_id: string;
  owner_name: string | null;
  owner_avatar_url: string | null;
  storage_path: string;
  created_at: string;
  mine: boolean;
  /** Filled in after signing; null while it loads. */
  url?: string | null;
  isVideo?: boolean;
};

const looksLikeVideo = (path: string) => /\.(mp4|mov|m4v|qt)$/i.test(path);

/** A file on this phone, ready to go: from that day's photos, or from the full picker. */
export type Shareable = { uri: string; isVideo: boolean; filename?: string | null };

type State = {
  byNearMiss: Record<string, SharedPhoto[]>;
  busy: Record<string, boolean>;
  load: (nearMissId: string) => Promise<void>;
  /** Shares files the person picked from that day. */
  share: (nearMissId: string, shots: Shareable[]) => Promise<void>;
  /** The fallback: the system picker over the whole library, with its own permission prompt. */
  shareFromLibrary: (nearMissId: string) => Promise<void>;
  remove: (nearMissId: string, photo: SharedPhoto) => Promise<void>;
  reset: () => void;
};

const extOf = (f: Shareable) =>
  (f.filename?.split('.').pop() || f.uri.split('?')[0].split('.').pop() || (f.isVideo ? 'mp4' : 'jpg')).toLowerCase();

const typeOf = (ext: string, isVideo: boolean) =>
  isVideo
    ? (ext === 'mov' || ext === 'qt' ? 'video/quicktime' : 'video/mp4')
    : ext === 'png' ? 'image/png' : ext === 'heic' ? 'image/heic' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

async function sign(rows: SharedPhoto[]): Promise<SharedPhoto[]> {
  if (!rows.length) return rows;
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(rows.map((r) => r.storage_path), SIGNED_FOR);
  const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return rows.map((r) => ({ ...r, url: urls.get(r.storage_path) ?? null, isVideo: looksLikeVideo(r.storage_path) }));
}

export const useSharedPhotos = create<State>((set, get) => ({
  byNearMiss: {},
  busy: {},
  load: async (nearMissId) => {
    const { data, error } = await supabase.rpc('near_miss_photos', { nm_id: nearMissId });
    if (error) return;
    const rows = await sign((data ?? []) as SharedPhoto[]);
    set({ byNearMiss: { ...get().byNearMiss, [nearMissId]: rows } });
  },

  share: async (nearMissId, shots) => {
    if (Platform.OS === 'web') throw new Error('Sharing a photo works in the Near Miss app on your phone.');
    if (!shots.length || get().busy[nearMissId]) return;

    set({ busy: { ...get().busy, [nearMissId]: true } });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in to share a photo.');

      let sent = 0;
      let firstError: string | null = null;

      for (const shot of shots) {
        try {
          const body = await (await fetch(shot.uri)).arrayBuffer();
          if (body.byteLength > MAX_BYTES) {
            throw new Error(shot.isVideo ? 'That clip is too big. Try a shorter one.' : 'That photo is too big.');
          }

          const ext = extOf(shot);
          // The path is what the security policies read: near miss, then owner.
          const path = `${nearMissId}/${user.id}/${Date.now()}-${sent}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(path, body, { contentType: typeOf(ext, shot.isVideo), upsert: false });
          if (upErr) throw new Error(`Couldn't upload that: ${upErr.message}`);

          const { error: rowErr } = await supabase
            .from('shared_photos')
            .insert({ near_miss_id: nearMissId, owner_id: user.id, storage_path: path });
          if (rowErr) {
            // Don't leave an orphan file behind if the row is refused.
            await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
            throw new Error(rowErr.message);
          }
          sent += 1;
        } catch (e) {
          // One bad file shouldn't lose the rest of the selection.
          if (!firstError) firstError = e instanceof Error ? e.message : String(e);
        }
      }

      await get().load(nearMissId);
      if (!sent && firstError) throw new Error(firstError);
      if (firstError) throw new Error(`Shared ${sent} of ${shots.length}. ${firstError}`);
    } finally {
      set({ busy: { ...get().busy, [nearMissId]: false } });
    }
  },

  shareFromLibrary: async (nearMissId) => {
    if (Platform.OS === 'web') throw new Error('Sharing a photo works in the Near Miss app on your phone.');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Picker = require('expo-image-picker') as typeof import('expo-image-picker');
    const perm = await Picker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error('Near Miss needs access to your photos to share one.');

    const picked = await Picker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      videoMaxDuration: 30,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });
    if (picked.canceled || !picked.assets?.length) return;

    await get().share(nearMissId, picked.assets.map((a) => ({
      uri: a.uri,
      isVideo: a.type === 'video',
      filename: a.fileName,
    })));
  },

  remove: async (nearMissId, photo) => {
    const { error } = await supabase.from('shared_photos').delete().eq('id', photo.id);
    if (error) throw new Error(error.message);
    await supabase.storage.from(BUCKET).remove([photo.storage_path]).catch(() => {});
    set({
      byNearMiss: {
        ...get().byNearMiss,
        [nearMissId]: (get().byNearMiss[nearMissId] ?? []).filter((p) => p.id !== photo.id),
      },
    });
  },

  reset: () => set({ byNearMiss: {}, busy: {} }),
}));
