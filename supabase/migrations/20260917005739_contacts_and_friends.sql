-- Contacts and friends.
-- 1. Your "this is me" hash comes only from your verified sign-in email(s), set by the server.
--    Apps can still store other hashes, but can't claim an address as their own.
drop policy if exists "own contact hashes" on public.contact_hashes;
create policy "read own contact hashes" on public.contact_hashes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "add own non-self hashes" on public.contact_hashes
  for insert to authenticated with check (user_id = (select auth.uid()) and is_self = false);
create policy "delete own contact hashes" on public.contact_hashes
  for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.register_my_contact_hashes()
returns int
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  n int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  insert into public.contact_hashes (user_id, hash, is_self)
  select uid, encode(extensions.digest(lower(trim(e.email)), 'sha256'), 'hex'), true
  from (
    select u.email from auth.users u where u.id = uid and u.email is not null and u.email_confirmed_at is not null
    union
    select i.identity_data ->> 'email' from auth.identities i
    where i.user_id = uid and coalesce(i.identity_data ->> 'email_verified', 'true') <> 'false'
      and i.identity_data ->> 'email' is not null
  ) e
  on conflict (user_id, hash) do update set is_self = true;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.register_my_contact_hashes() from public, anon;
grant execute on function public.register_my_contact_hashes() to authenticated;

-- 2. Friendships change only through these functions: adding someone who already added you
--    makes you friends; otherwise it's a request.
drop policy if exists "request friendship" on public.friendships;
drop policy if exists "update own friendships" on public.friendships;

create or replace function public.add_friend(target uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  a uuid;
  b uuid;
  fr public.friendships;
begin
  if me is null then raise exception 'not signed in'; end if;
  if target is null or target = me then raise exception 'invalid friend'; end if;
  if not exists (select 1 from auth.users where id = target) then raise exception 'invalid friend'; end if;
  if exists (select 1 from public.blocks where (blocker_id = me and blocked_id = target) or (blocker_id = target and blocked_id = me)) then
    raise exception 'invalid friend';
  end if;
  a := least(me, target);
  b := greatest(me, target);
  select * into fr from public.friendships where user_a = a and user_b = b for update;
  if not found then
    insert into public.friendships (user_a, user_b, requested_by) values (a, b, me);
    return 'requested';
  end if;
  if fr.status = 'accepted' then
    return 'friends';
  end if;
  if fr.requested_by <> me then
    update public.friendships set status = 'accepted', accepted_at = now() where user_a = a and user_b = b;
    return 'friends';
  end if;
  return 'requested';
end $$;
revoke execute on function public.add_friend(uuid) from public, anon;
grant execute on function public.add_friend(uuid) to authenticated;

-- 3. Your friend list, with who asked whom.
create or replace function public.my_friendships()
returns table (friend_id uuid, status text, requested_by_me boolean, username text, name text, avatar_url text)
language sql stable security invoker set search_path = '' as $$
  select case when f.user_a = (select auth.uid()) then f.user_b else f.user_a end,
         f.status,
         f.requested_by = (select auth.uid()),
         p.username::text, p.name, p.avatar_url
  from public.friendships f
  left join public.profiles p on p.id = case when f.user_a = (select auth.uid()) then f.user_b else f.user_a end
  where (select auth.uid()) in (f.user_a, f.user_b);
$$;
revoke execute on function public.my_friendships() from public, anon;
grant execute on function public.my_friendships() to authenticated;
;
