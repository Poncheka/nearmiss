create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in'; end if;

  delete from storage.objects
  where bucket_id = 'avatars' and (storage.foldername(name))[1] = uid::text;

  delete from auth.users where id = uid;
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;;
