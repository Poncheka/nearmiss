// Checks the Google Timeline parser against the three export formats.
//
// Worth having because the failure mode is silent: a parser that recognises nothing imports
// nothing and reports success. The fixtures below are the shapes Google actually emits, and one
// of them caught a real bug the first time this ran.
//
//   npx esbuild scripts/test-timeline-formats.ts --bundle --platform=node --outfile=/tmp/t.js && node /tmp/t.js
//
import { readLatLng, readTime, visitsFrom, pointsFrom } from '../src/lib/timelineFormats';

let fails = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => {
  if (!cond) { fails++; console.log('FAIL', name, extra ?? ''); }
  else console.log('  ok', name);
};

// --- coordinates ---
ok('geo: uri', JSON.stringify(readLatLng('geo:34.098250,-118.368530')) === JSON.stringify({ lat: 34.09825, lng: -118.36853 }), readLatLng('geo:34.098250,-118.368530'));
ok('degree string', JSON.stringify(readLatLng('50.620000°, 3.790000°')) === JSON.stringify({ lat: 50.62, lng: 3.79 }), readLatLng('50.620000°, 3.790000°'));
ok('latitudeE7', JSON.stringify(readLatLng({ latitudeE7: 340982500, longitudeE7: -1183685300 })) === JSON.stringify({ lat: 34.09825, lng: -118.36853 }));
ok('rejects junk', readLatLng('not a place') === null);
ok('rejects out of range', readLatLng('geo:999,999') === null);

// --- times ---
ok('iso', readTime('2017-08-11T09:34:00.000-07:00') === Date.parse('2017-08-11T09:34:00.000-07:00'));
ok('epoch ms string', readTime('1502469240000') === 1502469240000);
ok('epoch seconds string', readTime('1502469240') === 1502469240000);
ok('null', readTime(undefined) === null);

const H = 3600_000;
const base = Date.parse('2017-08-11T09:00:00.000Z');

// --- iPhone on-device: bare array, geo: uris, numbers as text ---
const iphone = [
  { startTime: new Date(base).toISOString(), endTime: new Date(base + 2 * H).toISOString(),
    visit: { hierarchyLevel: '0', probability: '0.9',
      topCandidate: { placeId: 'x', semanticType: 'INFERRED_HOME', probability: '0.8', placeLocation: 'geo:34.098250,-118.368530' } } },
  { startTime: new Date(base + 3 * H).toISOString(), endTime: new Date(base + 4 * H).toISOString(),
    activity: { start: 'geo:34.1,-118.3', end: 'geo:34.2,-118.4', distanceMeters: '900',
      topCandidate: { type: 'walking', probability: '0.9' } } },
  { startTime: new Date(base + 5 * H).toISOString(), endTime: new Date(base + 5.5 * H).toISOString(),
    timelinePath: [{ point: 'geo:34.11,-118.31', durationMinutesOffsetFromStartTime: '3' }] },
];
const a = visitsFrom(iphone);
ok('iphone: one visit only', a.length === 1, a);
ok('iphone: coords', a[0]?.lat === 34.09825 && a[0]?.lng === -118.36853);

// --- Android on-device: semanticSegments, degree strings ---
const android = { semanticSegments: [
  { startTime: new Date(base).toISOString(), endTime: new Date(base + H).toISOString(),
    visit: { topCandidate: { placeLocation: { latLng: '50.620000°, 3.790000°' } } } },
]};
const b = visitsFrom(android);
ok('android: nested latLng', b.length === 1 && b[0].lat === 50.62, b);

// --- Takeout: timelineObjects / placeVisit / latitudeE7 ---
const takeout = { timelineObjects: [
  { placeVisit: { location: { latitudeE7: 340982500, longitudeE7: -1183685300, name: 'Chateau Marmont' },
      duration: { startTimestamp: new Date(base).toISOString(), endTimestamp: new Date(base + H).toISOString() } } },
  { activitySegment: { startLocation: { latitudeE7: 1, longitudeE7: 1 },
      duration: { startTimestamp: new Date(base).toISOString(), endTimestamp: new Date(base + H).toISOString() } } },
]};
const c = visitsFrom(takeout);
ok('takeout: placeVisit only', c.length === 1 && Math.abs(c[0].lat - 34.09825) < 1e-6, c);

// --- garbage in ---
ok('empty for unknown shape', visitsFrom({ nope: 1 }).length === 0);
ok('empty for Records.json', visitsFrom({ locations: [{ latitudeE7: 1, longitudeE7: 1 }] }).length === 0);
ok('empty for null', visitsFrom(null).length === 0);

// --- points ---
const now = base + 200 * 24 * H;
const pts = pointsFrom([{ start: base, end: base + 2 * H, lat: 10, lng: 20 }], now);
ok('points every 10 min over 2h', pts.length === 13, pts.length);
ok('points share the coordinate', pts.every((p) => p.lat === 10));
ok('ids are stable and unique', new Set(pts.map((p) => p.id)).size === pts.length);
ok('ids are minute-rounded', pts[0].id === `t:${Math.round(base / 60000) * 60}`);

const short = pointsFrom([{ start: base, end: base + 60_000, lat: 1, lng: 2 }], now);
ok('drops sub-5-minute visits', short.length === 0, short);

const recent = pointsFrom([{ start: now - 2 * H, end: now - H, lat: 1, lng: 2 }], now);
ok('drops the last 30 days', recent.length === 0, recent);

const long = pointsFrom([{ start: base, end: base + 48 * H, lat: 1, lng: 2 }], now);
ok('caps a runaway visit at 8h', long.length === 49, long.length);

const overlap = pointsFrom([
  { start: base, end: base + H, lat: 1, lng: 2 },
  { start: base, end: base + H, lat: 1, lng: 2 },
], now);
ok('re-import of the same window does not duplicate', overlap.length === 7, overlap.length);

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
