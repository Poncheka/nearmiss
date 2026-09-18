// Reading Google Timeline exports.
//
// Pure parsing, kept apart from the network and the file system so it can be tested against real
// export shapes. Three formats exist in the wild and this reads all three, because which one
// someone gets depends on their phone and on when they last exported:
//
//   iPhone, from the Google Maps app:   a bare JSON array, coordinates as "geo:34.09,-118.36"
//   Android, from Settings > Location:  { semanticSegments: [...] }, coordinates as "34.09°, -118.36°"
//   Google Takeout:                     { timelineObjects: [...] }, coordinates as latitudeE7 integers
//
// Only visits are read, never the movement traces between them. A path point every few seconds
// on a freeway would match two strangers driving past each other, which is true and worth
// nothing, and it would bury the real near misses in noise.

/** A stretch of time spent in one place. */
export type Visit = { start: number; end: number; lat: number; lng: number };

/** Visits shorter than this are noise — a traffic light, a wrong turn. */
const MIN_VISIT_MS = 5 * 60 * 1000;
/** One point per this much time inside a visit. Must stay under the matcher's 15-minute gap. */
const STEP_MS = 10 * 60 * 1000;
/** Nobody stands still for a day; a visit longer than this is Google being confused. */
const MAX_VISIT_MS = 8 * 60 * 60 * 1000;
/** Same rule as photos: nothing from the last 30 days. */
const RECENT_DAYS = 30;
const UPLOAD_BATCH = 500;

const isLat = (n: number) => Number.isFinite(n) && n >= -90 && n <= 90;
const isLng = (n: number) => Number.isFinite(n) && n >= -180 && n <= 180;

/**
 * Pulls a coordinate out of whichever shape Google used.
 *
 *   iPhone export:   "geo:34.098250,-118.368530"
 *   Android export:  "34.098250°, -118.368530°"
 *   Takeout:         { latitudeE7: 340982500, longitudeE7: -1183685300 }
 *   older Takeout:   { latE7, lngE7 } or { latitude, longitude }
 */
export function readLatLng(value: unknown): { lat: number; lng: number } | null {
  if (typeof value === 'string') {
    const cleaned = value.replace(/^geo:/i, '').replace(/°/g, '');
    const [a, b] = cleaned.split(',').map((s) => Number(s.trim()));
    if (isLat(a) && isLng(b)) return { lat: a, lng: b };
    return null;
  }
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    // Android nests it one deeper: placeLocation: { latLng: "50.62°, 3.79°" }.
    if (typeof o.latLng === 'string') return readLatLng(o.latLng);
    if (typeof o.placeLocation === 'string') return readLatLng(o.placeLocation);
    const e7 = (k1: string, k2: string) => {
      const la = Number(o[k1]);
      const ln = Number(o[k2]);
      if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
      const lat = la / 1e7;
      const lng = ln / 1e7;
      return isLat(lat) && isLng(lng) ? { lat, lng } : null;
    };
    return e7('latitudeE7', 'longitudeE7')
      ?? e7('latE7', 'lngE7')
      ?? (() => {
        const lat = Number(o.latitude);
        const lng = Number(o.longitude);
        return isLat(lat) && isLng(lng) ? { lat, lng } : null;
      })();
  }
  return null;
}

/** Timestamps appear as ISO strings, epoch millisecond strings, or epoch seconds. */
export function readTime(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value > 1e11 ? value : value * 1000;
  if (typeof value !== 'string') return null;
  if (/^\d+$/.test(value)) {
    const n = Number(value);
    return n > 1e11 ? n : n * 1000;
  }
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

/** One segment from any of the formats, if it describes a visit. */
function visitFrom(seg: Record<string, unknown>): Visit | null {
  const visit = (seg.visit ?? seg.placeVisit) as Record<string, unknown> | undefined;
  if (!visit) return null;

  // Takeout puts the times inside the segment; both on-device formats put them at the top, and
  // Takeout nests them again under the visit itself in some vintages.
  const duration = (seg.duration ?? visit.duration) as Record<string, unknown> | undefined;
  const start = readTime(seg.startTime ?? seg.startTimestamp ?? seg.startTimestampMs ?? duration?.startTimestamp ?? duration?.startTimestampMs);
  const end = readTime(seg.endTime ?? seg.endTimestamp ?? seg.endTimestampMs ?? duration?.endTimestamp ?? duration?.endTimestampMs);
  if (start == null || end == null || end <= start) return null;

  const candidate = (visit.topCandidate ?? visit.location) as Record<string, unknown> | undefined;
  const where =
    readLatLng(candidate?.placeLocation)
    ?? readLatLng(candidate?.latLng)
    ?? readLatLng(candidate)
    ?? readLatLng((visit as any).location)
    ?? readLatLng((visit as any).placeLocation);
  if (!where) return null;

  return { start, end, lat: where.lat, lng: where.lng };
}

/**
 * Finds the visits in a parsed export, whichever shape it is.
 *
 * Returns an empty list for a file that parses but holds nothing we recognise, so the screen can
 * say "this doesn't look like a Timeline export" rather than silently importing nothing.
 */
export function visitsFrom(parsed: unknown): Visit[] {
  let segments: unknown[] = [];

  if (Array.isArray(parsed)) {
    segments = parsed;                                   // iPhone on-device: a bare array
  } else if (parsed && typeof parsed === 'object') {
    const o = parsed as Record<string, unknown>;
    if (Array.isArray(o.semanticSegments)) segments = o.semanticSegments;        // Android on-device
    else if (Array.isArray(o.timelineObjects)) segments = o.timelineObjects;     // Takeout monthly
    else if (Array.isArray(o.locations)) segments = [];                          // raw Records.json: no visits
  }

  const out: Visit[] = [];
  for (const raw of segments) {
    if (!raw || typeof raw !== 'object') continue;
    const v = visitFrom(raw as Record<string, unknown>);
    if (v) out.push(v);
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * Turns visits into the same kind of points a photo scan produces: one every ten minutes for as
 * long as the visit lasted, so the matcher sees a stay rather than two disconnected pings.
 */
export function pointsFrom(visits: Visit[], now = Date.now()): { id: string; t: number; lat: number; lng: number }[] {
  const cutoff = now - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const seen = new Set<string>();
  const out: { id: string; t: number; lat: number; lng: number }[] = [];

  for (const v of visits) {
    if (v.end - v.start < MIN_VISIT_MS) continue;
    const end = Math.min(v.end, v.start + MAX_VISIT_MS);
    for (let t = v.start; t <= end; t += STEP_MS) {
      if (t > cutoff) break;
      // Rounded to the minute so re-importing an overlapping export lands on the same key.
      const id = `t:${Math.round(t / 60000) * 60}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ id, t, lat: v.lat, lng: v.lng });
    }
  }
  return out;
}

