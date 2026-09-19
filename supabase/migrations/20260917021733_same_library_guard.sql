-- Two accounts that scanned the same photo library (test accounts, a shared iPad, one person's
-- phone and tablet) are treated as the same person: the matcher must never show near misses
-- between them.
--
-- Signal 1: photo ids are local to one device, so any shared ids mean the same device.
-- Signal 2: a large share of photos taken at the exact same second and spot (iCloud-synced devices).
-- A few identical photos between real friends (AirDropped pictures) don't trigger it.
create or replace function private.same_photo_library(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  with smaller as (
    select least(
      (select count(*) from public.location_points where user_id = a),
      (select count(*) from public.location_points where user_id = b)
    ) as n
  )
  select a = b
    or exists (
      select 1 from public.location_points pa
      join public.location_points pb on pb.user_id = b and pb.source = pa.source and pb.asset_id = pa.asset_id
      where pa.user_id = a
      offset 4 limit 1               -- 5+ shared ids
    )
    or (
      select count(*) from public.location_points pa
      join public.location_points pb
        on pb.user_id = b and pb.at = pa.at
       and extensions.st_dwithin(pa.geom, pb.geom, 2)
      where pa.user_id = a
    ) > greatest(20, (select n from smaller) * 0.3);
$$;
revoke execute on function private.same_photo_library(uuid, uuid) from public, anon, authenticated;
;
