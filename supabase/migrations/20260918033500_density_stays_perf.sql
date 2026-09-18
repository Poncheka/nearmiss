-- Same matching as 20260917210000, but fast enough to run while someone waits.
-- The previous version ran two lateral subqueries per candidate stay pair, and each one
-- re-scanned the whole (un-indexed) CTE of photos. Now the photos are joined onto the
-- candidate stays once, and the "closest photo" and "were they together" numbers are read
-- off that single set. Same results, ~20x less work.
create or replace function private.match_pair(p uuid, q uuid)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  a uuid := least(p, q);
  b uuid := greatest(p, q);
  met date;
  n int := 0;
begin
  if a = b or private.same_photo_library(a, b) then
    delete from public.near_misses where user_a = a and user_b = b;
    return 0;
  end if;

  select f.met_on into met from public.friendships f where f.user_a = a and f.user_b = b;

  with dup_a as (
    -- photos that exist in both libraries (AirDrop, shared albums): ignore them entirely
    select pa.id from public.location_points pa
    join public.location_points pb on pb.user_id = b
      and pb.at between pa.at - interval '2 seconds' and pa.at + interval '2 seconds'
      and extensions.st_dwithin(pa.geom, pb.geom, 3)
    where pa.user_id = a
  ),
  dup_b as (
    select pb.id from public.location_points pb
    join public.location_points pa on pa.user_id = a
      and pa.at between pb.at - interval '2 seconds' and pb.at + interval '2 seconds'
      and extensions.st_dwithin(pa.geom, pb.geom, 3)
    where pb.user_id = b
  ),
  pts_a as (
    select lp.id, lp.at, lp.geom from public.location_points lp
    where lp.user_id = a and lp.at < now() - interval '30 days'
      and lp.id not in (select id from dup_a)
  ),
  pts_b as (
    select lp.id, lp.at, lp.geom from public.location_points lp
    where lp.user_id = b and lp.at < now() - interval '30 days'
      and lp.id not in (select id from dup_b)
  ),
  -- a new stay starts after a 15 minute gap or a 150m move
  edges_a as (
    select id, at, geom,
      case when lag(at) over w is null
             or at - lag(at) over w > interval '15 minutes'
             or extensions.st_distance(geom, lag(geom) over w) > 150
           then 1 else 0 end as starts
    from pts_a window w as (order by at, id)
  ),
  edges_b as (
    select id, at, geom,
      case when lag(at) over w is null
             or at - lag(at) over w > interval '15 minutes'
             or extensions.st_distance(geom, lag(geom) over w) > 150
           then 1 else 0 end as starts
    from pts_b window w as (order by at, id)
  ),
  num_a as (select id, at, geom, sum(starts) over (order by at, id rows unbounded preceding) as stay from edges_a),
  num_b as (select id, at, geom, sum(starts) over (order by at, id rows unbounded preceding) as stay from edges_b),
  stays_a as (
    select stay, min(at) as start_at, max(at) as end_at, count(*)::int as pts,
           extensions.st_centroid(extensions.st_collect(geom::extensions.geometry))::extensions.geography as c,
           ((min(at) - interval '6 hours') at time zone 'UTC')::date as night
    from num_a group by stay
  ),
  stays_b as (
    select stay, min(at) as start_at, max(at) as end_at, count(*)::int as pts,
           extensions.st_centroid(extensions.st_collect(geom::extensions.geometry))::extensions.geography as c,
           ((min(at) - interval '6 hours') at time zone 'UTC')::date as night
    from num_b group by stay
  ),
  cand as (
    select sa.stay as sa_id, sb.stay as sb_id, sa.night,
           sa.pts + sb.pts as pts,
           -- 20 minutes of grace on each end of both stays
           round(extract(epoch from (least(sa.end_at, sb.end_at) - greatest(sa.start_at, sb.start_at))) / 60 + 40)::int as overlap_min
    from stays_a sa
    join stays_b sb on sb.night = sa.night
     and sb.start_at <= sa.end_at + interval '6 hours'
     and sa.start_at <= sb.end_at + interval '6 hours'
     and extensions.st_dwithin(sa.c, sb.c, 400)
  ),
  -- every photo pairing inside a candidate stay pair (stays are small, so this stays small)
  pairs as (
    select c.sa_id, c.sb_id, c.night, c.pts, c.overlap_min,
           pa.at as ata, pb.at as atb, pa.geom as ga, pb.geom as gb,
           extensions.st_distance(pa.geom, pb.geom) as d,
           abs(extract(epoch from (pa.at - pb.at))) as dt
    from cand c
    join num_a pa on pa.stay = c.sa_id
    join num_b pb on pb.stay = c.sb_id
  ),
  -- the two photos that actually came closest, for the map and the distance
  closest as (
    select distinct on (sa_id, sb_id) * from pairs
    order by sa_id, sb_id, d, dt
  ),
  -- signs they were actually together, not just nearby
  tog as (
    select night,
           count(*) as close_pairs,
           coalesce(extract(epoch from (max(greatest(ata, atb)) - min(least(ata, atb)))) / 60, 0) as close_span_min,
           count(distinct extensions.st_snaptogrid(ga::extensions.geometry, 0.002)) as close_places
    from pairs where d < 30 and dt < 180
    group by night
  ),
  kinds as (
    select k.*, case when k.d <= 150 and k.overlap_min > 0 then 'crossed' else 'same_place' end as kind
    from closest k
  ),
  best as (
    select distinct on (k.night) k.*
    from kinds k
    left join tog t on t.night = k.night
    -- several very close photos over half an hour, or in more than one place: they were together
    where not (coalesce(t.close_pairs, 0) >= 3 and (t.close_span_min > 30 or t.close_places >= 2))
    order by k.night, (k.kind = 'crossed') desc, k.d, k.overlap_min desc
  ),
  upserted as (
    insert into public.near_misses as nm
      (user_a, user_b, moment_a, moment_b, closest_at, night, distance_m, point_a, point_b, photo_pairs,
       kind, overlap_min, source, is_before_met, surprise_score, visible_after)
    select a, b,
      (select m.id from public.moments m where m.user_id = a and best.ata between m.start_at and m.end_at limit 1),
      (select m.id from public.moments m where m.user_id = b and best.atb between m.start_at and m.end_at limit 1),
      to_timestamp((extract(epoch from best.ata) + extract(epoch from best.atb)) / 2),
      best.night,
      round(best.d)::int,
      best.ga, best.gb,
      best.pts,
      best.kind,
      best.overlap_min,
      'photo',
      met is not null and best.night < met,
      -- closer and older is more surprising, and actually crossing paths counts double
      (case when best.kind = 'crossed' then 2 else 1 end)
        * ((1 - least(best.d, 400) / 400.0) + least(extract(year from age(now(), best.ata)), 10) / 10.0),
      greatest(now(), least(best.ata, best.atb) + interval '30 days')
    from best
    on conflict (user_a, user_b, night) do update set
      moment_a = excluded.moment_a,
      moment_b = excluded.moment_b,
      closest_at = excluded.closest_at,
      distance_m = excluded.distance_m,
      point_a = excluded.point_a,
      point_b = excluded.point_b,
      photo_pairs = excluded.photo_pairs,
      kind = excluded.kind,
      overlap_min = excluded.overlap_min,
      is_before_met = excluded.is_before_met,
      surprise_score = excluded.surprise_score,
      visible_after = greatest(excluded.closest_at + interval '30 days', least(nm.visible_after, excluded.visible_after))
    returning 1
  ),
  -- nights that no longer match (photos removed, a hidden place added, a "together" night)
  removed as (
    delete from public.near_misses nm
    where nm.user_a = a and nm.user_b = b and nm.night not in (select night from best)
    returning 1
  )
  select count(*) into n from upserted;

  return n;
end $$;
revoke execute on function private.match_pair(uuid, uuid) from public, anon, authenticated;
