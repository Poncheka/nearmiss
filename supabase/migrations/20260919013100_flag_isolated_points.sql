-- Photos that were sent to you, not taken by you.
--
-- A photo someone AirDrops or texts keeps the time and place it was taken, so it lands in your
-- library claiming you were somewhere you have never been. Claire got one from a friend who was
-- with Jeff in Santa Barbara, and the app decided they had nearly crossed paths.
--
-- iOS has no "this was sent to me" flag, and metadata is a poor substitute: a photo you edited
-- later looks the same. But the data contradicts itself, and that is checkable. Claire was in
-- Los Angeles at 18:53 and again at 22:11. The Santa Barbara photo sits at 20:22, ninety-five
-- miles away. One photo, a hundred and ninety miles of driving, nothing either side.
--
-- So: a point is not evidence of presence when it is far from everything else that person did
-- around it, and nothing else of theirs is near it. A real trip leaves a trail.
alter table public.location_points add column if not exists isolated boolean;

comment on column public.location_points.isolated is
  'True when this point contradicts the rest of that person''s timeline, which usually means the photo was sent to them. Excluded from matching.';

/** How far from your own surrounding points before a place stops being plausible. */
create or replace function private.flag_isolated_points(uid uuid)
returns integer language plpgsql security definer set search_path to '' as $$
declare
  far_m constant double precision := 25000;   -- 25km from the points either side
  near_m constant double precision := 2000;   -- what counts as "something else of yours nearby"
  window_h constant interval := interval '12 hours';
  local_h constant interval := interval '3 hours';
  changed integer;
begin
  with ordered as (
    select id, at, geom,
           lag(geom) over w as prev_geom, lag(at) over w as prev_at,
           lead(geom) over w as next_geom, lead(at) over w as next_at
    from public.location_points
    where user_id = uid
    window w as (order by at)
  ),
  judged as (
    select o.id,
      -- Far from the point before and the point after, both within half a day.
      (o.prev_at is not null and o.next_at is not null
       and o.at - o.prev_at < window_h and o.next_at - o.at < window_h
       and extensions.st_distance(o.geom, o.prev_geom) > far_m
       and extensions.st_distance(o.geom, o.next_geom) > far_m
       -- And nothing else of yours is anywhere near it in space and time. A real visit leaves
       -- more than one trace; a forwarded photo leaves exactly one.
       and (select count(*) from public.location_points x
            where x.user_id = uid and x.id <> o.id
              and x.at between o.at - local_h and o.at + local_h
              and extensions.st_distance(x.geom, o.geom) < near_m) < 2
      ) as is_isolated
    from ordered o
  )
  update public.location_points lp
  set isolated = j.is_isolated
  from judged j
  where lp.id = j.id and lp.isolated is distinct from j.is_isolated;

  get diagnostics changed = row_count;
  return changed;
end $$;;
