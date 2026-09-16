-- Photo scan support: hidden places are enforced in the database, moments are built server-side.

-- 1. Never store a point that falls inside one of the owner's hidden places.
create or replace function private.drop_hidden_point()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.hidden_zones z
    where z.user_id = new.user_id
      and extensions.st_dwithin(z.center, new.geom, z.radius_m)
  ) then
    return null; -- silently skip
  end if;
  return new;
end $$;
revoke execute on function private.drop_hidden_point() from public, anon, authenticated;

create trigger location_points_skip_hidden before insert on public.location_points
  for each row execute function private.drop_hidden_point();

-- 2. Adding (or moving) a hidden place removes points already saved inside it.
create or replace function private.purge_hidden_zone()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.location_points p
  where p.user_id = new.user_id
    and extensions.st_dwithin(new.center, p.geom, new.radius_m);
  delete from public.moments m
  where m.user_id = new.user_id
    and extensions.st_dwithin(new.center, m.centroid, new.radius_m);
  return null;
end $$;
revoke execute on function private.purge_hidden_zone() from public, anon, authenticated;

create trigger hidden_zones_purge after insert or update on public.hidden_zones
  for each row execute function private.purge_hidden_zone();

-- 3. Hidden places with readable coordinates (owner only, via RLS).
create or replace function public.my_hidden_zones()
returns table (id uuid, label text, latitude double precision, longitude double precision, radius_m int, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select z.id, z.label,
         extensions.st_y(z.center::extensions.geometry),
         extensions.st_x(z.center::extensions.geometry),
         z.radius_m, z.created_at
  from public.hidden_zones z
  where z.user_id = (select auth.uid())
  order by z.created_at;
$$;
revoke execute on function public.my_hidden_zones() from public, anon;
grant execute on function public.my_hidden_zones() to authenticated;

-- 4. Rebuild the caller's moments from their points.
-- A new moment starts when the gap from the previous photo is over 15 minutes
-- or the previous photo was more than 150m away.
create or replace function public.rebuild_my_moments()
returns int
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  n int;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  delete from public.moments where user_id = uid;

  with ordered as (
    select p.id, p.asset_id, p.at, p.geom,
           lag(p.at) over w as prev_at,
           lag(p.geom) over w as prev_geom
    from public.location_points p
    where p.user_id = uid
    window w as (order by p.at, p.id)
  ), flagged as (
    select *,
           case when prev_at is null
                  or at - prev_at > interval '15 minutes'
                  or extensions.st_distance(geom, prev_geom) > 150
                then 1 else 0 end as starts
    from ordered
  ), grouped as (
    select *, sum(starts) over (order by at, id) as grp
    from flagged
  )
  insert into public.moments (user_id, start_at, end_at, centroid, point_count, cover_asset_id, source)
  select uid, min(at), max(at),
         extensions.st_centroid(extensions.st_collect(geom::extensions.geometry))::extensions.geography,
         count(*),
         min(asset_id),
         'photo'
  from grouped
  group by grp;

  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.rebuild_my_moments() from public, anon;
grant execute on function public.rebuild_my_moments() to authenticated;

-- 5. Numbers for the scan screen and the You tab.
create or replace function public.my_scan_stats()
returns table (points bigint, moments bigint, oldest timestamptz, newest timestamptz, last_saved timestamptz)
language sql stable security invoker set search_path = '' as $$
  select
    (select count(*) from public.location_points where user_id = (select auth.uid())),
    (select count(*) from public.moments where user_id = (select auth.uid())),
    (select min(at) from public.location_points where user_id = (select auth.uid())),
    (select max(at) from public.location_points where user_id = (select auth.uid())),
    (select max(created_at) from public.location_points where user_id = (select auth.uid()));
$$;
revoke execute on function public.my_scan_stats() from public, anon;
grant execute on function public.my_scan_stats() to authenticated;

-- 6. Wipe my scanned data (used by "Delete scanned data").
create or replace function public.clear_my_locations()
returns void
language sql security invoker set search_path = '' as $$
  delete from public.moments where user_id = (select auth.uid());
  delete from public.location_points where user_id = (select auth.uid());
$$;
revoke execute on function public.clear_my_locations() from public, anon;
grant execute on function public.clear_my_locations() to authenticated;
