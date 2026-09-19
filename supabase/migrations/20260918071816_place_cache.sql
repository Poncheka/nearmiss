-- Venue names looked up from Foursquare, keyed by a ~11m grid cell ("40.7233,-73.9987").
-- Two near misses at the same bar share one row, and one lookup.
create table if not exists public.place_cache (
  cell text primary key,
  name text,
  category text,
  fetched_at timestamptz not null default now()
);

comment on table public.place_cache is
  'Foursquare venue names by coarse coordinate. Written only by the place-name Edge Function.';
comment on column public.place_cache.name is
  'Null means "we looked and there is no venue here" — worth caching too.';

-- RLS on with no policies at all: the Edge Function reaches this with the service role, which
-- bypasses RLS, and nobody else can read or write it.
alter table public.place_cache enable row level security;

create index if not exists place_cache_fetched_at_idx on public.place_cache (fetched_at);
;
