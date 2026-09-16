-- Photo storage
-- avatars: public read, you write only inside your own folder (avatars/<user id>/...)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- shared-photos: private. Path is <near miss id>/<owner id>/<file>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shared-photos', 'shared-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "replace own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "delete own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "upload shared photo" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'shared-photos'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and public.is_near_miss_participant(((storage.foldername(name))[1])::uuid)
  );
create policy "view shared photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'shared-photos'
    and public.is_near_miss_participant(((storage.foldername(name))[1])::uuid)
  );
create policy "delete own shared photo" on storage.objects
  for delete to authenticated
  using (bucket_id = 'shared-photos' and (storage.foldername(name))[2] = (select auth.uid())::text);
