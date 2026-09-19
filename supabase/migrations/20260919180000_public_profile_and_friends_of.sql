-- Looking someone up, and looking at who they know.
--
-- Finding a username and being offered nothing but "Add" is a dead end: you cannot tell whether
-- this is the right Sarah. But this app tells people where you have been, so a social graph
-- open to anyone who guesses a username is a bigger exposure here than on most apps.
--
-- The rule: if you are already friends you see their whole list. If you are not, you see only
-- the people you both know, which is the part that actually helps you decide, and their wider
-- circle stays theirs. Blocks cut both ways throughout.

create or replace function public.public_profile(uid uuid)
returns table (id uuid, username text, name text, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username::text, p.name, p.avatar_url
  from public.profiles p
  where p.id = uid
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = p.id and b.blocked_id = (select auth.uid()))
         or (b.blocked_id = p.id and b.blocker_id = (select auth.uid()))
    )
  limit 1;
$$;
revoke execute on function public.public_profile(uuid) from public, anon;
grant execute on function public.public_profile(uuid) to authenticated;

create or replace function public.friends_of(uid uuid)
returns table (user_id uuid, username text, name text, avatar_url text, scope text)
language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) as uid),
  blocked as (
    select 1 from public.blocks b, me
    where (b.blocker_id = uid and b.blocked_id = me.uid)
       or (b.blocked_id = uid and b.blocker_id = me.uid)
  ),
  theirs as (
    select case when f.user_a = uid then f.user_b else f.user_a end as friend_id
    from public.friendships f
    where uid in (f.user_a, f.user_b) and f.status = 'accepted'
  ),
  mine as (
    select case when f.user_a = me.uid then f.user_b else f.user_a end as friend_id
    from public.friendships f, me
    where me.uid in (f.user_a, f.user_b) and f.status = 'accepted'
  ),
  connected as (select exists (select 1 from theirs t, me where t.friend_id = me.uid) as yes),
  visible as (
    select t.friend_id
    from theirs t, connected c, me
    where not exists (select 1 from blocked)
      and (c.yes or t.friend_id in (select friend_id from mine))
      and t.friend_id <> me.uid
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = t.friend_id and b.blocked_id = me.uid)
           or (b.blocked_id = t.friend_id and b.blocker_id = me.uid)
      )
  )
  select v.friend_id, p.username::text, p.name, p.avatar_url,
         case when (select yes from connected) then 'all' else 'mutual' end
  from visible v
  left join public.profiles p on p.id = v.friend_id
  order by p.name nulls last, p.username;
$$;
revoke execute on function public.friends_of(uuid) from public, anon;
grant execute on function public.friends_of(uuid) to authenticated;
