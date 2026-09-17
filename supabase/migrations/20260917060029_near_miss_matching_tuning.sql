-- Matching tuning: ignore photos that exist in both libraries entirely, and a stronger
-- "they were together" rule (close photos over 30+ minutes or in more than one place).
-- Finds (and refreshes) near misses between two people. Returns how many nights matched.
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
  pairs as (
    select pa.id as ida, pb.id as idb, pa.at as ata, pb.at as atb, pa.geom as ga, pb.geom as gb,
           extensions.st_distance(pa.geom, pb.geom) as d,
           abs(extract(epoch from (pa.at - pb.at))) as dt,
           ((least(pa.at, pb.at) - interval '6 hours') at time zone 'UTC')::date as night
    from public.location_points pa
    join public.location_points pb
      on pb.user_id = b
     and pb.at between pa.at - interval '15 minutes' and pa.at + interval '15 minutes'
     and extensions.st_dwithin(pa.geom, pb.geom, 100)
    where pa.user_id = a
      and pa.at < now() - interval '30 days'
      and pb.at < now() - interval '30 days'
      and pa.id not in (select id from dup_a)
      and pb.id not in (select id from dup_b)
  ),
  real_pairs as (select * from pairs),
  nights as (
    select night,
           count(*) as n_pairs,
           count(*) filter (where d < 30 and dt < 180) as close_pairs,
           coalesce(extract(epoch from (max(greatest(ata, atb)) filter (where d < 30 and dt < 180)
                                      - min(least(ata, atb)) filter (where d < 30 and dt < 180))) / 60, 0) as close_span_min,
           count(distinct extensions.st_snaptogrid(ga::extensions.geometry, 0.002)) filter (where d < 30 and dt < 180) as close_places
    from real_pairs
    group by night
  ),
  best as (
    select distinct on (rp.night) rp.*, nt.n_pairs
    from real_pairs rp
    join nights nt using (night)
    -- several very close photos for over half an hour, or in more than one place: they were together
    where not (nt.close_pairs >= 3 and (nt.close_span_min > 30 or nt.close_places >= 2))
    order by rp.night, rp.d, rp.dt
  ),
  upserted as (
    insert into public.near_misses as nm
      (user_a, user_b, moment_a, moment_b, closest_at, night, distance_m, point_a, point_b, photo_pairs,
       source, is_before_met, surprise_score, visible_after)
    select a, b,
      (select m.id from public.moments m where m.user_id = a and best.ata between m.start_at and m.end_at limit 1),
      (select m.id from public.moments m where m.user_id = b and best.atb between m.start_at and m.end_at limit 1),
      to_timestamp((extract(epoch from best.ata) + extract(epoch from best.atb)) / 2),
      best.night,
      round(best.d)::int,
      best.ga, best.gb,
      best.n_pairs,
      'photo',
      met is not null and best.night < met,
      -- closer and older is more surprising
      (1 - least(best.d, 100) / 100.0) + least(extract(year from age(now(), best.ata)), 10) / 10.0,
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

