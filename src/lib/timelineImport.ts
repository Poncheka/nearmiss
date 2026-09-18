// Importing location history from Google Timeline.
//
// Photos only know where you were when you took one. Timeline knows where you were the rest of
// the time, which is where most near misses actually live — the coffee shop you didn't
// photograph, the airport, the street you both walked down.
//
// Google retired the Timeline API and moved the data onto the phone, so there is no account to
// link: it has to be a file the person exports themselves. Three formats exist in the wild and
// this reads all three, because which one someone gets depends on their phone and on when they
// last exported.
//
// What gets imported: visits only — "you were at this place from 7.10pm to 9.40pm". Never the
// movement traces between them. A path point every few seconds on a freeway would match two
// strangers driving past each other, which is true and worth nothing, and it would bury the real
// near misses in noise.
//
// The file is read and parsed on the phone. Only the derived points are uploaded, the same ones
// a photo would produce. The export itself never leaves the device.
import { supabase } from '@/lib/supabase';
import { pointsFrom, visitsFrom } from '@/lib/timelineFormats';

export type ImportProgress = {
  phase: 'reading' | 'parsing' | 'saving' | 'done';
  visits: number;
  points: number;
  saved: number;
  oldest: number | null;
  newest: number | null;
};

export type ImportResult = ImportProgress & { skippedRecent: number };

const UPLOAD_BATCH = 500;

async function upload(uid: string, points: { id: string; t: number; lat: number; lng: number }[], onSaved: (n: number) => void) {
  let saved = 0;
  for (let k = 0; k < points.length; k += UPLOAD_BATCH) {
    const rows = points.slice(k, k + UPLOAD_BATCH).map((p) => ({
      user_id: uid,
      at: new Date(p.t).toISOString(),
      geom: `SRID=4326;POINT(${p.lng.toFixed(6)} ${p.lat.toFixed(6)})`,
      source: 'timeline',
      asset_id: p.id,
    }));
    const { error } = await supabase
      .from('location_points')
      .upsert(rows, { onConflict: 'user_id,source,asset_id', ignoreDuplicates: true });
    if (error) throw new Error(`Couldn't save your history: ${error.message}`);
    saved += rows.length;
    onSaved(saved);
  }
  return saved;
}

/** Reads the picked file, parses it, and saves what it found. */
export async function importTimelineFile(
  uri: string,
  opts: { onProgress?: (p: ImportProgress) => void } = {},
): Promise<ImportResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to import your history.');

  const p: ImportProgress = { phase: 'reading', visits: 0, points: 0, saved: 0, oldest: null, newest: null };
  const emit = () => opts.onProgress?.({ ...p });
  emit();

  let text: string;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const FS = require('expo-file-system') as typeof import('expo-file-system');
    text = await new FS.File(uri).text();
  } catch (e) {
    throw new Error("Couldn't read that file. Try exporting it again.");
  }

  p.phase = 'parsing';
  emit();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't the Timeline export. It should be a .json file from Google Maps.");
  }
  // Let the (potentially very large) string go before building the points.
  text = '';

  const visits = visitsFrom(parsed);
  if (!visits.length) {
    throw new Error("No visits in that file. If you exported from Google Takeout, pick the Timeline export from the Google Maps app instead.");
  }
  p.visits = visits.length;

  const points = pointsFrom(visits);
  p.points = points.length;
  p.oldest = points.length ? points[0].t : null;
  p.newest = points.length ? points[points.length - 1].t : null;
  const skippedRecent = visits.length && !points.length ? visits.length : 0;
  emit();

  p.phase = 'saving';
  emit();
  await upload(user.id, points, (n) => { p.saved = n; emit(); });

  p.phase = 'done';
  emit();
  return { ...p, skippedRecent };
}

/** Removes everything imported from Timeline, leaving photo points alone. */
export async function clearTimelineData() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('location_points')
    .delete()
    .eq('user_id', user.id)
    .eq('source', 'timeline');
  if (error) throw new Error(error.message);
}

/** How much imported history is on file. */
export async function timelineStats(): Promise<{ points: number; oldest: string | null; newest: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { points: 0, oldest: null, newest: null };
  const { count } = await supabase
    .from('location_points')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('source', 'timeline');

  const { data: first } = await supabase
    .from('location_points').select('at').eq('user_id', user.id).eq('source', 'timeline')
    .order('at', { ascending: true }).limit(1).maybeSingle();
  const { data: last } = await supabase
    .from('location_points').select('at').eq('user_id', user.id).eq('source', 'timeline')
    .order('at', { ascending: false }).limit(1).maybeSingle();

  return { points: count ?? 0, oldest: first?.at ?? null, newest: last?.at ?? null };
}
