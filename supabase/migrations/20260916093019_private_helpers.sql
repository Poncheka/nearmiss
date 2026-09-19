-- Keep helper functions out of the public API.
create schema if not exists private;
grant usage on schema private to authenticated;

-- Participant check used by row-level security policies
create or replace function private.is_near_miss_participant(nm_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.near_misses n
    where n.id = nm_id
      and (select auth.uid()) in (n.user_a, n.user_b)
      and n.visible_after <= now()
  );
$$;
revoke execute on function private.is_near_miss_participant(uuid) from public, anon;
grant execute on function private.is_near_miss_participant(uuid) to authenticated;

-- Point policies at the private helper
alter policy "see shared photos" on public.shared_photos using (private.is_near_miss_participant(near_miss_id));
alter policy "share own photos" on public.shared_photos with check (owner_id = (select auth.uid()) and private.is_near_miss_participant(near_miss_id));
alter policy "see comments" on public.comments using (private.is_near_miss_participant(near_miss_id));
alter policy "write comments" on public.comments with check (author_id = (select auth.uid()) and private.is_near_miss_participant(near_miss_id));
alter policy "give feedback" on public.match_feedback with check (user_id = (select auth.uid()) and private.is_near_miss_participant(near_miss_id));
alter policy "upload shared photo" on storage.objects with check (
  bucket_id = 'shared-photos'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and private.is_near_miss_participant(((storage.foldername(name))[1])::uuid)
);
alter policy "view shared photos" on storage.objects using (
  bucket_id = 'shared-photos'
  and private.is_near_miss_participant(((storage.foldername(name))[1])::uuid)
);
drop function public.is_near_miss_participant(uuid);

-- Signup trigger: move to private and make it uncallable directly
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'));
  insert into public.user_settings (user_id) values (new.id);
  return new;
end $$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;
drop trigger on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();
drop function public.handle_new_user();

revoke execute on function public.set_updated_at() from public, anon, authenticated;
;
