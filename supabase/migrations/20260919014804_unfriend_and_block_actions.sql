-- A way out, and a way to keep someone away.
--
-- The blocks table already existed and is already respected by friend requests, contact
-- matching, username search and match_candidates. What was missing was any way to put a row in
-- it, or to undo a friendship at all. This app tells people where you have been; leaving has to
-- actually remove what they can see.
--
-- Unfriend is the ordinary one: the friendship ends and the near misses between you go with it.
-- Either of you can ask again afterwards.
--
-- Block is the safety one: the same erasure, plus a row that stops requests, search, contact
-- matching and matching itself. Only the person who blocked can undo it.

/** True when either person has blocked the other. */
create or replace function private.is_blocked(one uuid, two uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = one and b.blocked_id = two)
       or (b.blocker_id = two and b.blocked_id = one)
  );
$$;

/** Everything the two of you shared, so leaving means the same thing in both directions. */
create or replace function private.erase_pair(one uuid, two uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare
  a uuid := least(one, two);
  b uuid := greatest(one, two);
begin
  -- Near misses cascade to their comments and shared photo rows. The files themselves are
  -- removed by the app, which is the only thing allowed to write to the bucket.
  delete from public.near_misses where user_a = a and user_b = b;
  delete from public.friendships where user_a = a and user_b = b;
  delete from public.activity
    where (user_id = one and actor_id = two) or (user_id = two and actor_id = one);
  -- Drop the cached fingerprint so the pair is reconsidered from scratch if they reconnect.
  delete from private.match_runs where user_a = a and user_b = b;
end $$;

create or replace function public.unfriend(other uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in'; end if;
  if other = uid then raise exception 'cannot unfriend yourself'; end if;
  perform private.erase_pair(uid, other);
end $$;

create or replace function public.block_user(other uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in'; end if;
  if other = uid then raise exception 'cannot block yourself'; end if;
  insert into public.blocks (blocker_id, blocked_id) values (uid, other) on conflict do nothing;
  perform private.erase_pair(uid, other);
end $$;

create or replace function public.unblock_user(other uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in'; end if;
  delete from public.blocks where blocker_id = uid and blocked_id = other;
end $$;

/** Who you have blocked, for the settings list that lets you undo it. */
create or replace function public.my_blocks()
returns table(user_id uuid, name text, username text, avatar_url text, created_at timestamptz)
language sql stable security definer set search_path to '' as $$
  select b.blocked_id, p.name, p.username::text, p.avatar_url, b.created_at
  from public.blocks b
  left join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = (select auth.uid())
  order by b.created_at desc;
$$;

grant execute on function public.unfriend(uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.my_blocks() to authenticated;;
