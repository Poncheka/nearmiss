-- Deleting your account. Every table hangs off auth.users with ON DELETE CASCADE, so removing
-- that one row takes the profile, settings, photo locations, moments, hidden places, contact
-- hashes, friendships, near misses (including the copies other people see), comments, feedback
-- and read state with it. Uploaded avatars live in storage and have to go separately.
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in'; end if;

  -- profile photos we host (a Google or Apple photo lives on their servers, not ours)
  delete from storage.objects
  where bucket_id = 'avatars' and (storage.foldername(name))[1] = uid::text;

  delete from auth.users where id = uid;
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
