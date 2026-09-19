-- Turning off contact matching.
--
-- Worth being precise about what is stored, because the app promises your contacts stay on your
-- phone and that promise is true: contact_hashes holds a hash of your *own* phone number and
-- email, never anyone else's. It is what lets a friend who has your number find you without
-- either of you uploading an address book.
--
-- So unlinking means two separate things, and the app should do both: stop being findable that
-- way (this function), and forget the copy of the address book held on the device (the app).
-- Revoking the operating system permission is a third thing that only the person can do, in
-- iOS Settings, and the screen says so rather than pretending otherwise.
create or replace function public.unlink_my_contacts()
returns integer language plpgsql security definer set search_path to '' as $$
declare uid uuid := (select auth.uid()); n integer;
begin
  if uid is null then raise exception 'not signed in'; end if;
  delete from public.contact_hashes where user_id = uid;
  get diagnostics n = row_count;
  return n;
end $$;

/** Whether friends who have your number or email can currently find you. */
create or replace function public.contacts_linked()
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.contact_hashes
    where user_id = (select auth.uid()) and is_self
  );
$$;

grant execute on function public.unlink_my_contacts() to authenticated;
grant execute on function public.contacts_linked() to authenticated;;
