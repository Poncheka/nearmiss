-- Looking someone up, and looking at who they know.
--
-- Finding a username and being offered nothing but "Add" is a dead end: you cannot tell whether
-- this is the right Sarah. But this app tells people where you have been, so a social graph
-- open to anyone who guesses a username is a bigger exposure here than on most apps.
--
-- The rule: if you are already friends you see their whole list. If you are not, you see only
-- the people you both know, which is the part that actually helps you decide, and their wider
-- circle stays theirs. Blocks cut both ways throughout.

-- The handful of fields a stranger's profile needs. Deliberately the same four that username
-- search already returns, so this exposes nothing new: no birthday, no settings, no counts.
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

-- Their friends, as much of them as you are entitled to see.
--
-- 'mutual' vs 'all' comes back with the rows so the screen can say which it is showing rather
-- than implying it is the whole list. Someone with no accepted friendship to you always gets
-- the mutual treatment, including when they have never heard of you.
create or replace function public.friends_of(uid uuid)
returns table (user_id uuid, username text, name text, avatar_url text, scope text)
language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) as uid),
  blocked as (
    select 1 from public.blocks b, me
    where (b.blocker_id = uid and b.blocked_id = me.uid)
       or (b.blocked_id = uid and b.blocker_id = me.uid)
  ),
  -- Everyone they have actually accepted.
  theirs as (
    select case when f.user_a = uid then f.user_b else f.user_a end as friend_id
    from public.friendships f
    where uid in (f.user_a, f.user_b) and f.status = 'accepted'
  ),
  -- Everyone I have actually accepted.
  mine as (
    select case when f.user_a = me.uid then f.user_b else f.user_a end as friend_id
    from public.friendships f, me
    where me.uid in (f.user_a, f.user_b) and f.status = 'accepted'
  ),
  -- Am I one of theirs? That is what unlocks the full list.
  connected as (select exists (select 1 from theirs t, me where t.friend_id = me.uid) as yes),
  visible as (
    select t.friend_id
    from theirs t, connected c, me
    where not exists (select 1 from blocked)
      and (c.yes or t.friend_id in (select friend_id from mine))
      and t.friend_id <> me.uid
      -- Never surface someone who has blocked me, or whom I have blocked.
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
grant execute on function public.friends_of(uuid) to authenticated;;
