-- Density: match on "stays" (a run of photos in one place) rather than single photos,
-- and add a second, softer tier so people actually get near misses.
--
--   crossed     you overlapped in time and were within 150m  (the good one)
--   same_place  same night, within 400m, up to 6 hours apart (the softer one)
--
-- A stay gets 20 minutes of grace on each end, because you don't take a photo
-- the moment you arrive or the moment you leave.

alter table public.near_misses
  add column if not exists kind text not null default 'crossed'
    check (kind in ('crossed', 'same_place')),
  add column if not exists overlap_min int;

comment on column public.near_misses.kind is 'crossed = overlapping in time and close; same_place = same night, same area';
comment on column public.near_misses.overlap_min is 'minutes the two stays overlapped (negative = minutes apart)';

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
           round(extract(epoch from (least(sa.end_at, sb.end_at) - greatest(sa.start_at, sb.start_at))) / 60 + 40)::int as overlap_min,
           extensions.st_distance(sa.c, sb.c) as cd
    from stays_a sa
    join stays_b sb on sb.night = sa.night
     and sb.start_at <= sa.end_at + interval '6 hours'
     and sa.start_at <= sb.end_at + interval '6 hours'
     and extensions.st_dwithin(sa.c, sb.c, 400)
  ),
  -- the two photos that actually came closest, for the map and the distance
  closest as (
    select c.*, p.ata, p.atb, p.ga, p.gb, p.d,
           tg.close_pairs, tg.close_span_min, tg.close_places
    from cand c
    cross join lateral (
      select pa.at as ata, pb.at as atb, pa.geom as ga, pb.geom as gb,
             extensions.st_distance(pa.geom, pb.geom) as d
      from num_a pa, num_b pb
      where pa.stay = c.sa_id and pb.stay = c.sb_id
      order by extensions.st_distance(pa.geom, pb.geom), abs(extract(epoch from (pa.at - pb.at)))
      limit 1
    ) p
    cross join lateral (
      -- signs they were actually together, not just nearby
      select count(*)::int as close_pairs,
             coalesce(extract(epoch from (max(greatest(pa.at, pb.at)) - min(least(pa.at, pb.at)))) / 60, 0) as close_span_min,
             count(distinct extensions.st_snaptogrid(pa.geom::extensions.geometry, 0.002))::int as close_places
      from num_a pa
      join num_b pb on pb.stay = c.sb_id
        and pb.at between pa.at - interval '3 minutes' and pa.at + interval '3 minutes'
        and extensions.st_dwithin(pa.geom, pb.geom, 30)
      where pa.stay = c.sa_id
    ) tg
  ),
  kinds as (
    select k.*, case when k.d <= 150 and k.overlap_min > 0 then 'crossed' else 'same_place' end as kind
    from closest k
  ),
  nights as (
    select night,
           sum(close_pairs) as close_pairs,
           max(close_span_min) as close_span_min,
           sum(close_places) as close_places
    from kinds group by night
  ),
  best as (
    select distinct on (k.night) k.*
    from kinds k
    join nights nt using (night)
    -- several very close photos over half an hour, or in more than one place: they were together
    where not (nt.close_pairs >= 3 and (nt.close_span_min > 30 or nt.close_places >= 2))
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

-- my_near_misses now also says which tier each one is.
drop function if exists public.my_near_misses();
create function public.my_near_misses()
returns table (
  id uuid, other_id uuid, other_username text, other_name text, other_avatar_url text,
  via_id uuid, via_name text,
  closest_at timestamptz, night date, distance_m int, place_name text,
  kind text, overlap_min int,
  my_lat double precision, my_lng double precision,
  their_lat double precision, their_lng double precision,
  is_before_met boolean, is_new boolean,
  comment_count bigint, unread_count bigint, visible_after timestamptz
)
language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) as uid),
  mine as (
    select n.*, case when n.user_a = me.uid then n.user_b else n.user_a end as other,
           case when n.user_a = me.uid then n.point_a else n.point_b end as my_pt,
           case when n.user_a = me.uid then n.point_b else n.point_a end as their_pt
    from public.near_misses n, me
    where me.uid in (n.user_a, n.user_b) and n.visible_after <= now()
      and not exists (select 1 from public.match_feedback f where f.near_miss_id = n.id and f.user_id = me.uid and f.kind in ('together', 'not_interesting'))
  ),
  cands as (select * from private.match_candidates((select uid from me)))
  select m.id, m.other, p.username::text, p.name, p.avatar_url,
         c.via, vp.name,
         m.closest_at, m.night, m.distance_m, m.place_name,
         m.kind, m.overlap_min,
         extensions.st_y(m.my_pt::extensions.geometry), extensions.st_x(m.my_pt::extensions.geometry),
         extensions.st_y(m.their_pt::extensions.geometry), extensions.st_x(m.their_pt::extensions.geometry),
         m.is_before_met,
         rs.last_read_at is null,
         (select count(*) from public.comments cm where cm.near_miss_id = m.id),
         (select count(*) from public.comments cm where cm.near_miss_id = m.id
            and cm.author_id <> (select uid from me)
            and cm.created_at > coalesce(rs.last_read_at, '-infinity'::timestamptz)),
         m.visible_after
  from mine m
  left join public.profiles p on p.id = m.other
  left join cands c on c.other = m.other
  left join public.profiles vp on vp.id = c.via
  left join public.read_state rs on rs.near_miss_id = m.id and rs.user_id = (select uid from me)
  order by m.closest_at;
$$;
revoke execute on function public.my_near_misses() from public, anon;
grant execute on function public.my_near_misses() to authenticated;;
