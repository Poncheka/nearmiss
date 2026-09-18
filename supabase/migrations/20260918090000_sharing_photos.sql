-- Sharing a photo from the day you nearly met.
--
-- Most of this was already designed: the shared_photos table, its policies, and the storage
-- policies on the 'shared-photos' bucket, which key off a <near_miss_id>/<owner_id>/<file>
-- path and check that you are one of the two people. Only a participant can upload, only a
-- participant can read, and you can only remove your own. That all stays.
--
-- What was missing: video, and telling the other person it happened.

-- Videos of the night, not just stills. 50MB covers a short clip at phone quality.
update storage.buckets
   set allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp', 'image/heic',
         'video/mp4', 'video/quicktime'
       ],
       file_size_limit = 52428800
 where id = 'shared-photos';

-- "Leigh shared a photo from that night."
create or replace function private.on_shared_photo_activity()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  nm public.near_misses;
  other uuid;
begin
  select * into nm from public.near_misses where id = new.near_miss_id;
  if not found then return null; end if;

  other := case when nm.user_a = new.owner_id then nm.user_b else nm.user_a end;
  if other = new.owner_id then return null; end if;

  insert into public.activity (user_id, actor_id, type, near_miss_id, payload)
  values (other, new.owner_id, 'photo_shared', new.near_miss_id,
          jsonb_build_object('path', new.storage_path));
  return null;
end $$;

drop trigger if exists shared_photos_activity on public.shared_photos;
create trigger shared_photos_activity
  after insert on public.shared_photos
  for each row execute function private.on_shared_photo_activity();

-- Everything shared on one near miss, oldest first, with who shared it.
create or replace function public.near_miss_photos(nm_id uuid)
returns table (
  id uuid, owner_id uuid, owner_name text, owner_avatar_url text,
  storage_path text, created_at timestamptz, mine boolean
)
language sql stable security definer set search_path = '' as $$
  select s.id, s.owner_id, p.name, p.avatar_url,
         s.storage_path, s.created_at,
         s.owner_id = (select auth.uid())
  from public.shared_photos s
  left join public.profiles p on p.id = s.owner_id
  where s.near_miss_id = nm_id
    and private.is_near_miss_participant(nm_id)
  order by s.created_at;
$$;
revoke execute on function public.near_miss_photos(uuid) from public, anon;
grant execute on function public.near_miss_photos(uuid) to authenticated;

create index if not exists shared_photos_near_miss_idx on public.shared_photos (near_miss_id, created_at);
