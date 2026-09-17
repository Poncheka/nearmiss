-- Near miss matching.
-- Two people's photos count as a near miss when they were taken within 15 minutes and 100m of each
-- other, the people didn't scan the same library, and they weren't obviously together that night.
-- One near miss per pair per night, visible no sooner than 30 days after it happened.

-- Where each person was, for the map (only these two points are ever shown to the other person).
alter table public.near_misses
  add column if not exists point_a extensions.geography(point, 4326),
  add column if not exists point_b extensions.geography(point, 4326),
  add column if not exists photo_pairs int not null default 1;

-- Who can be matched with whom:
--   friends always; friends of friends when both people allow it in settings. Never blocked pairs.
create or replace function private.match_candidates(uid uuid)
returns table (other uuid, via uuid)
language sql stable security definer set search_path = '' as $$
  with my_friends as (
    select case when f.user_a = uid then f.user_b else f.user_a end as friend
    from public.friendships f
    where f.status = 'accepted' and uid in (f.user_a, f.user_b)
  ),
  fof as (
    select distinct on (case when f.user_a = mf.friend then f.user_b else f.user_a end)
      case when f.user_a = mf.friend then f.user_b else f.user_a end as other,
      mf.friend as via
    from my_friends mf
    join public.friendships f on f.status = 'accepted' and mf.friend in (f.user_a, f.user_b)
    where (select audience from public.user_settings where user_id = uid) = 'fof'
  ),
  all_candidates as (
    select friend as other, null::uuid as via from my_friends
    union all
    select fof.other, fof.via from fof
    join public.user_settings s on s.user_id = fof.other and s.audience = 'fof'
    where fof.other <> uid and fof.other not in (select friend from my_friends)
  )
  select distinct on (c.other) c.other, c.via
  from all_candidates c
  where not exists (
    select 1 from public.blocks b
    where (b.blocker_id = uid and b.blocked_id = c.other) or (b.blocker_id = c.other and b.blocked_id = uid)
  )
  order by c.other, c.via nulls first;
$$;
revoke execute on function private.match_candidates(uuid) from public, anon, authenticated;

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

  with pairs as (
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
  ),
  real_pairs as (
    -- the same photo in both libraries (AirDrop, shared albums) isn't a near miss
    select * from pairs where not (dt < 2 and d < 3)
  ),
  nights as (
    select night,
           count(*) as n_pairs,
           count(*) filter (where d < 30 and dt < 180) as close_pairs,
           extract(epoch from (max(greatest(ata, atb)) - min(least(ata, atb)))) / 60 as span_min
    from real_pairs
    group by night
  ),
  best as (
    select distinct on (rp.night) rp.*, nt.n_pairs
    from real_pairs rp
    join nights nt using (night)
    -- lots of very close photos over more than an hour: they were probably together
    where not (nt.close_pairs >= 6 and nt.span_min > 60)
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

-- Match one person against everyone they're allowed to match with.
create or replace function private.match_user(uid uuid)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  total int := 0;
begin
  for c in select other from private.match_candidates(uid) loop
    total := total + private.match_pair(uid, c.other);
  end loop;
  -- people who are no longer friends (or friends of friends) lose their near misses
  delete from public.near_misses nm
  where uid in (nm.user_a, nm.user_b)
    and (case when nm.user_a = uid then nm.user_b else nm.user_a end) not in (select other from private.match_candidates(uid));
  return total;
end $$;
revoke execute on function private.match_user(uuid) from public, anon, authenticated;

-- Called by the app after a scan, after adding a friend, or when opening the feed.
create or replace function public.refresh_my_near_misses()
returns int
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in'; end if;
  return private.match_user(uid);
end $$;
revoke execute on function public.refresh_my_near_misses() from public, anon;
grant execute on function public.refresh_my_near_misses() to authenticated;

-- The feed.
create or replace function public.my_near_misses()
returns table (
  id uuid, other_id uuid, other_username text, other_name text, other_avatar_url text,
  via_id uuid, via_name text,
  closest_at timestamptz, night date, distance_m int, place_name text,
  my_lat double precision, my_lng double precision, their_lat double precision, their_lng double precision,
  is_before_met boolean, is_new boolean, comment_count bigint, unread_count bigint, visible_after timestamptz
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
grant execute on function public.my_near_misses() to authenticated;

-- Save a place name the app looked up (only if none is set yet).
create or replace function public.set_near_miss_place(nm_id uuid, name text)
returns void
language sql security definer set search_path = '' as $$
  update public.near_misses
  set place_name = left(trim(name), 80)
  where id = nm_id and place_name is null and (select auth.uid()) in (user_a, user_b)
    and coalesce(trim(name), '') <> '';
$$;
revoke execute on function public.set_near_miss_place(uuid, text) from public, anon;
grant execute on function public.set_near_miss_place(uuid, text) to authenticated;

-- Mark a near miss as read (for the "new" dot and unread replies).
create or replace function public.mark_near_miss_read(nm_id uuid)
returns void
language sql security definer set search_path = '' as $$
  insert into public.read_state (user_id, near_miss_id, last_read_at)
  select (select auth.uid()), nm_id, now()
  where private.is_near_miss_participant(nm_id)
  on conflict (user_id, near_miss_id) do update set last_read_at = now();
$$;
revoke execute on function public.mark_near_miss_read(uuid) from public, anon;
grant execute on function public.mark_near_miss_read(uuid) to authenticated;

-- Re-match right away when two people become friends.
create or replace function private.on_friendship_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform private.match_user(old.user_a);
    perform private.match_user(old.user_b);
    return null;
  end if;
  if new.status = 'accepted' and (tg_op = 'INSERT' or old.status is distinct from 'accepted') then
    perform private.match_user(new.user_a);
    perform private.match_user(new.user_b);
  end if;
  return null;
end $$;
revoke execute on function private.on_friendship_change() from public, anon, authenticated;
drop trigger if exists friendships_match on public.friendships;
create trigger friendships_match after insert or update or delete on public.friendships
  for each row execute function private.on_friendship_change();

-- Nightly: everyone with photos, so near misses appear as photos pass the 30-day mark.
create or replace function private.match_everyone()
returns int
language plpgsql security definer set search_path = '' as $$
declare
  u record;
  total int := 0;
begin
  for u in select distinct user_id from public.location_points loop
    total := total + private.match_user(u.user_id);
  end loop;
  return total;
end $$;
revoke execute on function private.match_everyone() from public, anon, authenticated;
