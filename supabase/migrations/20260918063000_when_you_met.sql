-- "When did you two meet?"
--
-- The first real test of the app found 39 near misses between two people who have been a
-- couple since early 2026. Six were genuine — years apart, hours apart, strangers in the same
-- neighbourhood. The other 25+ were holidays they took together: Cannes, Ojai, Nashville,
-- three nights running each time, sometimes three metres apart.
--
-- No detector fixes that reliably, because two people on holiday together look exactly like
-- two people who keep barely missing each other. The person knows the answer, so ask them:
-- once we know the date they met, everything before it is the feed and everything after it
-- goes in its own section.
--
-- met_on already existed on friendships and is_before_met on near_misses. Neither was ever
-- set, which is why every near miss showed the same (missing) badge.

-- Either person can say when they met. It is a shared fact, so it applies to both of them.
create or replace function public.set_met_on(friend uuid, on_date date)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  a uuid;
  b uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if friend is null or friend = me then raise exception 'invalid friend'; end if;
  if on_date is not null and on_date > current_date then raise exception 'that date is in the future'; end if;

  a := least(me, friend);
  b := greatest(me, friend);

  update public.friendships
     set met_on = on_date, met_on_source = 'user', met_on_set_by = me
   where user_a = a and user_b = b;
  if not found then raise exception 'you are not friends'; end if;

  -- Re-label what we already matched, rather than re-running the whole match for one date.
  update public.near_misses
     set is_before_met = (on_date is not null and night < on_date)
   where user_a = a and user_b = b;
end $$;
revoke execute on function public.set_met_on(uuid, date) from public, anon;
grant execute on function public.set_met_on(uuid, date) to authenticated;

-- my_friendships now says whether the date is known, so the app knows when to ask.
drop function if exists public.my_friendships();
create function public.my_friendships()
returns table (
  friend_id uuid, status text, requested_by_me boolean,
  username text, name text, avatar_url text,
  met_on date, near_miss_count bigint
)
language sql stable security definer set search_path = '' as $$
  select case when f.user_a = (select auth.uid()) then f.user_b else f.user_a end as friend_id,
         f.status,
         f.requested_by = (select auth.uid()),
         p.username::text, p.name, p.avatar_url,
         f.met_on,
         (select count(*) from public.near_misses n
           where n.user_a = f.user_a and n.user_b = f.user_b and n.visible_after <= now())
  from public.friendships f
  left join public.profiles p
    on p.id = case when f.user_a = (select auth.uid()) then f.user_b else f.user_a end
  where (select auth.uid()) in (f.user_a, f.user_b);
$$;
revoke execute on function public.my_friendships() from public, anon;
grant execute on function public.my_friendships() to authenticated;

-- A friend we have near misses with but no meeting date for. The app asks about these.
create or replace function public.friendships_needing_met_on()
returns table (friend_id uuid, name text, username text, avatar_url text, near_miss_count bigint, earliest date)
language sql stable security definer set search_path = '' as $$
  select case when f.user_a = (select auth.uid()) then f.user_b else f.user_a end,
         p.name, p.username::text, p.avatar_url,
         count(n.id), min(n.night)
  from public.friendships f
  join public.near_misses n on n.user_a = f.user_a and n.user_b = f.user_b and n.visible_after <= now()
  left join public.profiles p
    on p.id = case when f.user_a = (select auth.uid()) then f.user_b else f.user_a end
  where (select auth.uid()) in (f.user_a, f.user_b)
    and f.status = 'accepted'
    and f.met_on is null
  group by 1, p.name, p.username, p.avatar_url
  having count(n.id) > 0;
$$;
revoke execute on function public.friendships_needing_met_on() from public, anon;
grant execute on function public.friendships_needing_met_on() to authenticated;
