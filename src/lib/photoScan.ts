// Reads where and when your photos were taken and saves just that (never the photo) to Supabase.
// Photos from the last 30 days are skipped. Hidden places (home, work) are dropped by the database.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

type ML = typeof import('expo-media-library');

const DAY = 24 * 60 * 60 * 1000;
export const RECENT_DAYS = 30;
const PAGE = 300;
const CONCURRENCY = 12;
const UPLOAD_BATCH = 500;

export type Access = 'granted' | 'limited' | 'denied' | 'undetermined' | 'unavailable';

export type ScanProgress = {
  phase: 'counting' | 'reading' | 'saving' | 'grouping' | 'done';
  total: number;      // photos older than 30 days on the phone
  scanned: number;    // photos looked at in this run (plus earlier runs)
  withLocation: number;
  oldest: number | null; // ms
};

export type ScanResult = ScanProgress & { saved: number; moments: number };

export type ScanStats = { points: number; moments: number; oldest: string | null; newest: string | null; lastSaved: string | null };

// Remembers how far we got, per user, so a scan can resume and a rescan only reads what's new.
type Cursor = { newest: number | null; oldest: number | null; complete: boolean; scanned: number; withLocation: number };
const cursorKey = (uid: string) => `nearmiss.scan.${uid}`;

async function readCursor(uid: string): Promise<Cursor> {
  try {
    const raw = await AsyncStorage.getItem(cursorKey(uid));
    if (raw) return JSON.parse(raw) as Cursor;
  } catch { /* start fresh */ }
  return { newest: null, oldest: null, complete: false, scanned: 0, withLocation: 0 };
}
const writeCursor = (uid: string, c: Cursor) => AsyncStorage.setItem(cursorKey(uid), JSON.stringify(c)).catch(() => {});
export const resetScanCursor = (uid: string) => AsyncStorage.removeItem(cursorKey(uid)).catch(() => {});

function lib(): ML | null {
  if (Platform.OS === 'web') return null;
  try {
    // Loaded lazily so the web preview (which has no photo library) still runs.
    return require('expo-media-library') as ML;
  } catch {
    return null;
  }
}

export const photoScanAvailable = Platform.OS !== 'web';

function toAccess(p: { status: string; granted: boolean; accessPrivileges?: string }): Access {
  if (p.accessPrivileges === 'limited') return 'limited';
  if (p.granted) return 'granted';
  if (p.status === 'undetermined') return 'undetermined';
  return 'denied';
}

export async function getPhotoAccess(): Promise<Access> {
  const ML = lib();
  if (!ML) return 'unavailable';
  return toAccess(await ML.getPermissionsAsync(false, ['photo']));
}

export async function requestPhotoAccess(): Promise<Access> {
  const ML = lib();
  if (!ML) return 'unavailable';
  return toAccess(await ML.requestPermissionsAsync(false, ['photo']));
}

/** On iOS "Limited Access", lets the person pick more photos. */
export async function choosePhotos() {
  const ML = lib();
  if (ML) await ML.presentPermissionsPicker(['photo']).catch(() => {});
}

async function pageBefore(ML: ML, beforeMs: number, afterMs: number | null): Promise<{ id: string; t: number }[]> {
  let q = new ML.Query()
    .eq(ML.AssetField.MEDIA_TYPE, ML.MediaType.IMAGE)
    .lt(ML.AssetField.CREATION_TIME, beforeMs);
  if (afterMs != null) q = q.gt(ML.AssetField.CREATION_TIME, afterMs);
  const rows = await q.orderBy({ key: ML.AssetField.CREATION_TIME, ascending: false }).limit(PAGE).exeForMetadata();
  return rows.filter((r) => r.creationTime != null).map((r) => ({ id: r.id, t: r.creationTime as number }));
}

async function countBefore(ML: ML, beforeMs: number): Promise<number> {
  // The API has no count, so walk ids only (cheap: no per-photo calls).
  let n = 0;
  let before = beforeMs;
  for (;;) {
    const rows = await new ML.Query()
      .eq(ML.AssetField.MEDIA_TYPE, ML.MediaType.IMAGE)
      .lt(ML.AssetField.CREATION_TIME, before)
      .orderBy({ key: ML.AssetField.CREATION_TIME, ascending: false })
      .limit(2000)
      .exeForMetadata();
    n += rows.length;
    const last = rows[rows.length - 1]?.creationTime;
    if (rows.length < 2000 || last == null) return n;
    before = last;
  }
}

async function locate(ML: ML, items: { id: string; t: number }[]) {
  const out: { id: string; t: number; lat: number; lng: number }[] = [];
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const item = items[i++];
      try {
        const loc = await new ML.Asset(item.id).getLocation();
        if (loc && Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude) && !(loc.latitude === 0 && loc.longitude === 0)) {
          out.push({ ...item, lat: loc.latitude, lng: loc.longitude });
        }
      } catch {
        // Photo deleted mid-scan, or unreadable. Skip it.
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return out;
}

async function upload(uid: string, points: { id: string; t: number; lat: number; lng: number }[]) {
  for (let k = 0; k < points.length; k += UPLOAD_BATCH) {
    const rows = points.slice(k, k + UPLOAD_BATCH).map((p) => ({
      user_id: uid,
      at: new Date(p.t).toISOString(),
      geom: `SRID=4326;POINT(${p.lng.toFixed(6)} ${p.lat.toFixed(6)})`,
      source: 'photo',
      asset_id: p.id,
    }));
    const { error } = await supabase
      .from('location_points')
      .upsert(rows, { onConflict: 'user_id,source,asset_id', ignoreDuplicates: true });
    if (error) throw new Error(`Couldn't save photo locations: ${error.message}`);
  }
}

/**
 * Scans the library. First run reads everything older than 30 days (newest first, resumable).
 * Later runs read photos that have aged past 30 days since last time, then finish any unread older ones.
 */
export async function scanPhotos(opts: { onProgress?: (p: ScanProgress) => void; signal?: { cancelled: boolean } } = {}): Promise<ScanResult> {
  const ML = lib();
  if (!ML) throw new Error('Photo scanning works in the Near Miss app on your phone.');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to scan your photos.');
  const uid = user.id;

  const cutoff = Date.now() - RECENT_DAYS * DAY;
  const cur = await readCursor(uid);
  // If the saved data was cleared elsewhere, start over.
  const stats = await getScanStats();
  if (stats && stats.points === 0 && (cur.complete || cur.oldest != null)) {
    Object.assign(cur, { newest: null, oldest: null, complete: false, scanned: 0, withLocation: 0 });
  }
  const p: ScanProgress = { phase: 'counting', total: 0, scanned: cur.scanned, withLocation: cur.withLocation, oldest: cur.oldest };
  const emit = () => opts.onProgress?.({ ...p });
  emit();
  p.total = await countBefore(ML, cutoff);
  p.phase = 'reading';
  emit();

  let saved = 0;
  const run = async (from: number, until: number | null, onPage: (oldestInPage: number) => void) => {
    let before = from;
    for (;;) {
      if (opts.signal?.cancelled) return;
      const page = await pageBefore(ML, before, until);
      if (page.length === 0) return;
      const located = await locate(ML, page);
      if (located.length) {
        p.phase = 'saving';
        emit();
        await upload(uid, located);
        saved += located.length;
      }
      const oldestInPage = page[page.length - 1].t;
      p.scanned += page.length;
      p.withLocation += located.length;
      p.oldest = p.oldest == null ? oldestInPage : Math.min(p.oldest, oldestInPage);
      p.phase = 'reading';
      onPage(oldestInPage);
      emit();
      if (page.length < PAGE) return;
      // Next page: strictly older than the oldest photo in this one.
      before = oldestInPage;
    }
  };

  // 1. New since last time: photos that crossed the 30-day line since the last scan.
  if (cur.complete || cur.oldest != null) {
    const since = cur.newest ?? cutoff;
    if (since < cutoff) await run(cutoff, since, () => {});
    if (opts.signal?.cancelled) return finish(false);
    cur.newest = cutoff;
  }
  // 2. Older photos not read yet. The first run starts at the 30-day line and works back.
  if (!cur.complete) {
    cur.newest = cur.newest ?? cutoff;
    await run(cur.oldest ?? cutoff, null, (oldestInPage) => {
      cur.oldest = oldestInPage;
      cur.scanned = p.scanned;
      cur.withLocation = p.withLocation;
      writeCursor(uid, cur);
    });
    if (opts.signal?.cancelled) return finish(false);
    cur.complete = true;
  }
  return finish(true);

  async function finish(grouped: boolean): Promise<ScanResult> {
    cur.scanned = p.scanned;
    cur.withLocation = p.withLocation;
    await writeCursor(uid, cur);
    let moments = 0;
    if (grouped || saved > 0) {
      p.phase = 'grouping';
      emit();
      const { data, error } = await supabase.rpc('rebuild_my_moments');
      if (error) throw new Error(`Saved your photos but couldn't group them: ${error.message}`);
      moments = (data as number) ?? 0;
    }
    p.phase = 'done';
    emit();
    return { ...p, saved, moments };
  }
}

export async function getScanStats(): Promise<ScanStats | null> {
  const { data, error } = await supabase.rpc('my_scan_stats');
  if (error || !data) return null;
  const row = (Array.isArray(data) ? data[0] : data) as { points: number; moments: number; oldest: string | null; newest: string | null; last_saved: string | null };
  if (!row) return null;
  return { points: Number(row.points), moments: Number(row.moments), oldest: row.oldest, newest: row.newest, lastSaved: row.last_saved };
}

/** Deletes every saved photo location and starts the next scan from scratch. */
export async function clearScanData() {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.rpc('clear_my_locations');
  if (error) throw new Error(error.message);
  if (user) await resetScanCursor(user.id);
}
