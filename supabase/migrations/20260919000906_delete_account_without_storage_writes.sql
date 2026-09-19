-- Deleting an account failed with "Direct deletion from storage tables is not allowed".
--
-- Supabase puts a trigger on storage.objects that refuses plain SQL deletes, so the whole
-- transaction rolled back and the account survived. Nothing about it was recoverable from the
-- app, and it blocked testing sign-up over and over.
--
-- Files are now removed by the app through the Storage API before this is called, which is the
-- supported path. This function does what only the database can do: remove the user, and let
-- every foreign key cascade from there.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path to '' as $function$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = uid;
end $function$;;
