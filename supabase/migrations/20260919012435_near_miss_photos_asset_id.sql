-- The picker needs to know which of that day's photos are already on the near miss, so it can
-- show them as shared instead of offering them again.
drop function if exists public.near_miss_photos(uuid);

create function public.near_miss_photos(nm_id uuid)
returns table(id uuid, owner_id uuid, owner_name text, owner_avatar_url text,
              storage_path text, created_at timestamptz, mine boolean, asset_id text)
language sql stable security definer set search_path to ''
as $function$
  select s.id, s.owner_id, p.name, p.avatar_url,
         s.storage_path, s.created_at,
         s.owner_id = (select auth.uid()),
         s.asset_id
  from public.shared_photos s
  left join public.profiles p on p.id = s.owner_id
  where s.near_miss_id = nm_id
    and private.is_near_miss_participant(nm_id)
  order by s.created_at;
$function$;

grant execute on function public.near_miss_photos(uuid) to authenticated;;
