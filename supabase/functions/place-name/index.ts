// Turns a near miss's coordinates into the name of the place you were actually at.
//
// Apple's reverse geocoder, which the app uses on its own, gives you a neighbourhood or a
// street — "SoHo, New York". Foursquare gives you "Balthazar". This runs server-side for one
// reason: the Foursquare key must never sit in the app binary, where anyone can pull it out.
//
// Dormant until FOURSQUARE_API_KEY is set as an Edge Function secret. Without it the function
// answers with an empty list and the app quietly falls back to Apple's names, so deploying
// this ahead of the key breaks nothing.
//
// POST { points: [{ id, lat, lng }] }  ->  { places: [{ id, name, category }] }
// Points with no venue nearby are simply left out of the answer.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const FSQ_KEY = Deno.env.get("FOURSQUARE_API_KEY") ?? "";
// Foursquare pins the response shape to a date. Changing this is opting into a new shape.
const FSQ_VERSION = "2025-06-17";
const FSQ_URL = "https://places-api.foursquare.com/places/search";

// How far from the midpoint of the two people we'll still call it "the place they were".
const RADIUS_M = 120;
// Answers are cached on a ~11m grid, so two near misses at the same bar cost one lookup.
const CELL_DP = 4;
const MAX_POINTS = 25;
// Venues don't move. A long life here is the difference between a few hundred lookups and
// a few hundred thousand.
const CACHE_DAYS = 180;

// Categories that describe an area rather than somewhere you'd say you'd been.
const VAGUE = /^(neighborhood|city|town|state|country|region|road|street|intersection|residential building|housing development|bus (stop|line)|platform|train station platform)$/i;

type Point = { id: string; lat: number; lng: number };
type Place = { id: string; name: string; category: string | null };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const cellOf = (lat: number, lng: number) => `${lat.toFixed(CELL_DP)},${lng.toFixed(CELL_DP)}`;

/** Nearest real venue to a point, or null. Never throws — a lookup failing is not an error
 *  worth failing the whole request over. */
async function lookup(lat: number, lng: number): Promise<{ name: string; category: string | null } | null> {
  try {
    const url = new URL(FSQ_URL);
    url.searchParams.set("ll", `${lat},${lng}`);
    url.searchParams.set("radius", String(RADIUS_M));
    url.searchParams.set("limit", "10");
    url.searchParams.set("sort", "DISTANCE");
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${FSQ_KEY}`,
        "X-Places-Api-Version": FSQ_VERSION,
        accept: "application/json",
      },
    });
    if (!res.ok) {
      console.error("foursquare", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const body = await res.json();
    const results: any[] = body?.results ?? [];
    for (const r of results) {
      const name: string = r?.name ?? "";
      const category: string | null = r?.categories?.[0]?.name ?? null;
      if (!name) continue;
      if (category && VAGUE.test(category)) continue;
      return { name, category };
    }
    return null;
  } catch (e) {
    console.error("foursquare threw", e);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let points: Point[] = [];
  try {
    const body = await req.json();
    points = Array.isArray(body?.points) ? body.points : [];
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
  const { data: cached } = await db
    .from("place_cache")
    .select("cell,name,category,fetched_at")
    .in("cell", cells)
    .gte("fetched_at", fresh);

  const known = new Map<string, { name: string | null; category: string | null }>();
  for (const row of cached ?? []) known.set(row.cell, { name: row.name, category: row.category });

  // One lookup per unseen cell, in sequence — a burst of parallel calls is how you get rate
  // limited, and there are at most 25 of them.
  const learned: { cell: string; name: string | null; category: string | null }[] = [];
  for (const cell of cells) {
    if (known.has(cell)) continue;
    const [lat, lng] = cell.split(",").map(Number);
    const hit = await lookup(lat, lng);
    const row = { cell, name: hit?.name ?? null, category: hit?.category ?? null };
    known.set(cell, row);
    learned.push(row);
  }
  // Misses are cached too, under a null name: nowhere is still an answer.
  if (learned.length) {
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
  return json({ places, configured: true });
});
