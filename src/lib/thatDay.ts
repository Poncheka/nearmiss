// The photos you took at the near miss, found again on the phone.
//
// A near miss exists because two people's photos landed in the same place at the same time. So
// the photos worth sharing are already known: they are the ones on this phone from that window
// and that spot. Asking someone to hunt for them in a picker of their whole library throws that
// away — and triggers a second photo permission prompt on top.
//
// Nothing here leaves the phone. It reads the library the person already granted at sign-up,
// using the same media-library access the scan uses, and hands back local file URIs.
import { Platform } from 'react-native';

type ML = typeof import('expo-media-library');

/** How far either side of the near miss to look. Wide enough for a whole evening out. */
const WINDOW_MS = 4 * 60 * 60 * 1000;
/** How far from where you were. You move around a place; the photos should follow. */
const RADIUS_M = 500;
/** Reading locations is the slow part, so cap the work. */
const MAX_SCANNED = 400;
const MAX_RESULTS = 60;
const CONCURRENCY = 8;

export type LocalShot = {
  id: string;
  at: number;
  uri: string;
  isVideo: boolean;
  distanceM: number;
  filename: string | null;
};

export type ThatDayInput = {
  closest_at: string;
  my_lat: number;
  my_lng: number;
};

function lib(): ML | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-media-library') as ML;
  } catch {
    return null;
  }
}

export const thatDayAvailable = Platform.OS !== 'web';

/** Metres between two points. Good enough at these distances. */
function metresBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Photos and clips from around the near miss, oldest first.
 *
 * Returns an empty list rather than throwing when there is nothing to show — no photos from
 * that day, location turned off in the camera at the time, or the library unavailable. The
 * screen offers the full picker in that case, which is the one moment the extra prompt earns
 * its place.
 */
export async function shotsFromThatDay(nm: ThatDayInput): Promise<LocalShot[]> {
  const ML = lib();
  if (!ML) return [];

  const centre = new Date(nm.closest_at).getTime();
  if (!Number.isFinite(centre)) return [];

  let rows: { id: string; creationTime: number | null; mediaType: unknown; filename: string | null }[];
  try {
    rows = await new ML.Query()
      .within(ML.AssetField.MEDIA_TYPE, [ML.MediaType.IMAGE, ML.MediaType.VIDEO])
      .gt(ML.AssetField.CREATION_TIME, centre - WINDOW_MS)
      .lt(ML.AssetField.CREATION_TIME, centre + WINDOW_MS)
      .orderBy({ key: ML.AssetField.CREATION_TIME, ascending: true })
      .limit(MAX_SCANNED)
      .exeForMetadata();
  } catch {
    return [];
  }

  const items = rows.filter((r) => r.creationTime != null);
  const found: LocalShot[] = [];
  let i = 0;

  const worker = async () => {
    while (i < items.length && found.length < MAX_RESULTS) {
      const row = items[i++];
      try {
        const asset = new ML.Asset(row.id);
        const loc = await asset.getLocation();
        if (!loc || !Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) continue;
        if (loc.latitude === 0 && loc.longitude === 0) continue;
        const distanceM = metresBetween(nm.my_lat, nm.my_lng, loc.latitude, loc.longitude);
        if (distanceM > RADIUS_M) continue;
        // Only now, for the handful that qualify, pay for the URI.
        const uri = await asset.getUri();
        found.push({
          id: row.id,
          at: row.creationTime as number,
          uri,
          isVideo: row.mediaType === ML.MediaType.VIDEO,
          distanceM: Math.round(distanceM),
          filename: row.filename ?? null,
        });
      } catch {
        // Deleted mid-read, or in iCloud and not downloaded. Skip it.
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return found.sort((a, b) => a.at - b.at);
}
