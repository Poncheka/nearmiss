// Turns a near miss's coordinates into the name of the place you were actually at.
//
// Apple's reverse geocoder, which the app uses on its own, gives you a neighbourhood or a
// street — "SoHo, New York". Foursquare can give you "Chateau Marmont". This runs server-side
// for one reason: the Foursquare key must never sit in the app binary, where anyone can pull
// it out.
//
// Dormant until FOURSQUARE_API_KEY is set as an Edge Function secret. Without it the function
// answers with an empty list and the app quietly falls back to Apple's names, so deploying
// this ahead of the key breaks nothing.
//
// POST { points: [{ id, lat, lng }] }  ->  { places: [{ id, name, category }] }
// Points with no venue worth naming are simply left out of the answer.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const FSQ_KEY = Deno.env.get("FOURSQUARE_API_KEY") ?? "";
// Foursquare pins the response shape to a date. Changing this is opting into a new shape.
const FSQ_VERSION = "2025-06-17";
const FSQ_URL = "https://places-api.foursquare.com/places/search";

// How far out to ask. Wider than we'll actually use, so a venue's own pin being across the
// forecourt doesn't hide it.
const RADIUS_M = 150;
// How close a venue has to be before we'll put its name on a near miss. Photo GPS is good to
// 10-30m and the point we search from is the midpoint between two people, so anything past
// this is a different building and a confident-sounding lie.
const CLAIM_M = 45;
// Answers are cached on a ~11m grid, so two near misses at the same bar cost one lookup.
const CELL_DP = 4;
const MAX_POINTS = 25;
// Venues don't move. A long life here is the difference between a few hundred lookups and
// a few hundred thousand.
const CACHE_DAYS = 180;

// Categories that name an area rather than somewhere you'd say you had been.
const VAGUE = /(neighborhood|city|town|state|country|region|^road$|^street$|intersection|residential building|housing|bus (stop|line)|platform|parking|atm|storage)/i;

// Real places, but not ones worth putting on a memory. "You were both near J.Crew" is a worse
// sentence than "Abbot Kinney Blvd" — a shopfront is where you were standing, not where you
// were. Anything matching this is passed over even when it is the closest thing to the point.
const DULL = /(clothing|shoe store|cosmetics|men's store|women's store|boutique|antique|thrift|jewelry|optical|eyewear|pharmacy|drugstore|^bank|credit union|dry clean|laundr|salon|barber|nail|tanning|real estate|insurance|dentist|doctor|medical|emergency room|urgent care|veterinar|auto |car wash|gas station|hardware|mobile phone|electronics store|furniture|home (store|improvement)|pet supplies|office|coworking|warehouse|factory|construction|public art|^arts and entertainment$|miscellaneous|dealership|rental|post office|government|^school$|daycare)/i;

// Somewhere you'd tell a friend you were. A near miss at a bar is a story; the same near miss
// labelled with the dry cleaner two doors down is worse than saying "Abbot Kinney Blvd".
const EVOCATIVE = /(restaurant|bar$|^bar |pub|brewery|winery|café|cafe|coffee|bakery|diner|pizzeria|nightclub|music venue|theater|theatre|cinema|museum|gallery|park|beach|stadium|arena|hotel|resort|market|bookstore|club|lounge|garden|trail|pier|plaza|landmark|monument|zoo|aquarium|library|university|college|airport|train station|stadium)/i;

type Point = { id: string; lat: number; lng: number };
type Place = { id: string; name: string; category: string | null };
type Candidate = { name: string; category: string | null; distance: number; evocative: boolean };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const cellOf = (lat: number, lng: number) => `${lat.toFixed(CELL_DP)},${lng.toFixed(CELL_DP)}`;

/**
 * Picks the place worth naming, or nothing.
 *
 * Nearest-wins is the obvious rule and not quite right on its own: standing on a shopping
 * street, the nearest door is whichever shop you happened to be outside. So somewhere people
 * go — a bar, a park, a hotel — wins over a shopfront at the same distance, and anything
 * further than CLAIM_M is left to the phone to call a neighbourhood.
 *
 * Foursquare's foot-traffic score would be the better signal here, but popularity and rating
 * are Premium-tier fields; asking for them on a standard key fails the whole request.
 */
function pick(results: any[]): Candidate | null {
  const cands: Candidate[] = [];
  for (const r of results) {
    const name: string = r?.name ?? "";
    const category: string | null = r?.categories?.[0]?.name ?? null;
    const distance: number = Number(r?.distance ?? 9999);
    if (!name || distance > CLAIM_M) continue;
    if (r?.date_closed) continue; // gone
    if (category && (VAGUE.test(category) || DULL.test(category))) continue;
    cands.push({ name, category, distance, evocative: !!category && EVOCATIVE.test(category) });
  }
  if (!cands.length) return null;

  cands.sort((a, b) => (Number(b.evocative) - Number(a.evocative)) || (a.distance - b.distance));
  return cands[0];
}

/** Never throws — one lookup failing is not worth failing the whole request over. */
async function lookup(lat: number, lng: number, debug = false): Promise<{ candidates: any[]; best: Candidate | null }> {
  try {
    const url = new URL(FSQ_URL);
    url.searchParams.set("ll", `${lat},${lng}`);
    url.searchParams.set("radius", String(RADIUS_M));
    url.searchParams.set("limit", "20");
    url.searchParams.set("sort", "DISTANCE");
    // No explicit "fields": the Pro defaults include name, categories and distance, and naming
    // a Premium field (popularity, rating) makes the request fail outright.
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${FSQ_KEY}`,
        "X-Places-Api-Version": FSQ_VERSION,
        accept: "application/json",
      },
    });
    if (!res.ok) {
      console.error("foursquare", res.status, (await res.text()).slice(0, 200));
      return { candidates: [], best: null };
    }
    const body = await res.json();
    const results: any[] = body?.results ?? [];
    return { candidates: debug ? results : [], best: pick(results) };
  } catch (e) {
    console.error("foursquare threw", e);
    return { candidates: [], best: null };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let points: Point[] = [];
  let debug = false;
  try {
    const body = await req.json();
    points = Array.isArray(body?.points) ? body.points : [];
    debug = body?.debug === true;
  } catch {
    return json({ error: "Expected JSON" }, 400);
  }

  points = points
    .filter((p) => p && typeof p.id === "string" && Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .slice(0, MAX_POINTS);
  if (!points.length) return json({ places: [] });

  // No key yet: answer politely and let the app fall back to Apple's names.
  if (!FSQ_KEY) return json({ places: [], configured: false });

  // Service role, so the cache is readable and writable while staying closed to everyone else.
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const cells = [...new Set(points.map((p) => cellOf(p.lat, p.lng)))];
  const fresh = new Date(Date.now() - CACHE_DAYS * 864e5).toISOString();
  // Debug runs skip the cache, so tuning the rule doesn't mean reading yesterday's answers.
  const { data: cached } = debug
    ? { data: [] as any[] }
    : await db.from("place_cache").select("cell,name,category,fetched_at").in("cell", cells).gte("fetched_at", fresh);

  const known = new Map<string, { name: string | null; category: string | null }>();
  for (const row of cached ?? []) known.set(row.cell, { name: row.name, category: row.category });

  // One lookup per unseen cell, in sequence — a burst of parallel calls is how you get rate
  // limited, and there are at most 25 of them.
  const learned: { cell: string; name: string | null; category: string | null }[] = [];
  const seen: Record<string, unknown> = {};
  for (const cell of cells) {
    if (known.has(cell)) continue;
    const [lat, lng] = cell.split(",").map(Number);
    const { best, candidates } = await lookup(lat, lng, debug);
    if (debug) seen[cell] = candidates.length ? candidates : best;
    const row = { cell, name: best?.name ?? null, category: best?.category ?? null };
    known.set(cell, row);
    learned.push(row);
  }
  // Misses are cached too, under a null name: nowhere is still an answer.
  if (learned.length && !debug) {
    await db.from("place_cache").upsert(
      learned.map((r) => ({ ...r, fetched_at: new Date().toISOString() })),
      { onConflict: "cell" },
    );
  }

  const places: Place[] = [];
  for (const p of points) {
    const hit = known.get(cellOf(p.lat, p.lng));
    if (hit?.name) places.push({ id: p.id, name: hit.name, category: hit.category });
  }
  return json(debug ? { places, configured: true, seen } : { places, configured: true });
});
