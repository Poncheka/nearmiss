-- The numbers under someone's name.
--
-- The friend count is their real total, not a filtered one, because "Leigh has 14 friends" is a
-- fact about Leigh and a filtered number would be meaningless. Which of those 14 you can SEE is
-- a separate question, answered by friends_of: friends see all, others see mutuals only. So a
-- non-friend may see "14 friends" above a list of 2, which is honest rather than misleading.
create or replace function public.profile_stats(uid uuid)
returns table (friends bigint, near_misses bigint, mutuals bigint)
language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) as uid),
  theirs as (
    select case when f.user_a = uid then f.user_b else f.user_a end as friend_id
    from public.friendships f
    where uid in (f.user_a, f.user_b) and f.status = 'accepted'
  ),
  mine as (
    select case when f.user_a = me.uid then f.user_b else f.user_a end as friend_id
    from public.friendships f, me
    where me.uid in (f.user_a, f.user_b) and f.status = 'accepted'
  )
  select
    (select count(*) from theirs),
    (select count(*) from public.near_misses n, me
      where n.visible_after <= now()
        and ((n.user_a = me.uid and n.user_b = uid) or (n.user_b = me.uid and n.user_a = uid))),
    (select count(*) from theirs t where t.friend_id in (select friend_id from mine))
  where not exists (
    select 1 from public.blocks b, me
    where (b.blocker_id = uid and b.blocked_id = me.uid)
       or (b.blocked_id = uid and b.blocker_id = me.uid)
  );
$$;
revoke execute on function public.profile_stats(uuid) from public, anon;
grant execute on function public.profile_stats(uuid) to authenticated;
