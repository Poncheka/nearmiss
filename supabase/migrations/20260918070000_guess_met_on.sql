-- Guessing when two people met, so we can ask a question instead of a blank form.
--
-- Two strangers cross paths rarely and at random: months or years apart. Two people who know
-- each other turn up in the same place constantly. So the meeting date is where the rhythm
-- changes. On the first real pair in the app the gaps before were 158, 311, 193, 1345, 858
-- and 218 days; from one specific night onwards they were 1, 34, 5, 1, 12, 1, 1, 19, ...
--
-- The guess: the earliest night that has at least 3 near misses in the 90 days after it.
-- One chance encounter does not start a cluster; knowing someone does.
create or replace function private.guess_met_on(a uuid, b uuid)
returns date
language sql stable security definer set search_path = '' as $$
  select min(t.night) from (
    select n.night,
           (select count(*) from public.near_misses m
             where m.user_a = a and m.user_b = b
               and m.night >= n.night
               and m.night < n.night + 90)
           as nearby
    from public.near_misses n
    where n.user_a = a and n.user_b = b
  ) t
  where t.nearby >= 3;
$$;

-- Hand the guess to the app alongside the friend who needs a date.
drop function if exists public.friendships_needing_met_on();
create function public.friendships_needing_met_on()
returns table (
  friend_id uuid, name text, username text, avatar_url text,
  near_miss_count bigint, earliest date, guess date
)
language sql stable security definer set search_path = '' as $$
  select case when f.user_a = (select auth.uid()) then f.user_b else f.user_a end,
         p.name, p.username::text, p.avatar_url,
         count(n.id), min(n.night),
         private.guess_met_on(f.user_a, f.user_b)
  from public.friendships f
  join public.near_misses n on n.user_a = f.user_a and n.user_b = f.user_b and n.visible_after <= now()
  left join public.profiles p
    on p.id = case when f.user_a = (select auth.uid()) then f.user_b else f.user_a end
  where (select auth.uid()) in (f.user_a, f.user_b)
    and f.status = 'accepted'
    and f.met_on is null
  group by 1, p.name, p.username, p.avatar_url, f.user_a, f.user_b
  having count(n.id) > 0;
$$;
revoke execute on function public.friendships_needing_met_on() from public, anon;
grant execute on function public.friendships_needing_met_on() to authenticated;
