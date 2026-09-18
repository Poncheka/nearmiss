-- Matching two full photo libraries takes a few seconds, and the API cuts a request off at
-- 8 seconds. So: remember what each pair looked like the last time we matched it, skip the
-- pairs that haven't changed, and stop after a time budget when someone is waiting on it.
-- Whatever doesn't fit is picked up by the nightly job.

create table if not exists private.match_runs (
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  fingerprint text not null,
  matched_at timestamptz not null default now(),
  primary key (user_a, user_b)
);
alter table private.match_runs enable row level security;  -- no policies: only these functions touch it

-- Changes whenever either person's photos or hidden places change.
-- Bump the version prefix whenever matching itself changes, to force a re-match.
create or replace function private.pair_fingerprint(a uuid, b uuid)
returns text
language sql stable security definer set search_path = '' as $$
  select 'v2|' || string_agg(s, '|' order by s) from (
    select x.u::text
        || ':' || coalesce((select count(*)::text || '@' || max(lp.created_at)::text
                            from public.location_points lp where lp.user_id = x.u), '0')
        || '/' || coalesce((select count(*)::text || '@' || max(hz.created_at)::text
                            from public.hidden_zones hz where hz.user_id = x.u), '0') as s
    from (select a as u union all select b) x
  ) t;
$$;

-- Matches everyone you could have a near miss with, newest change first.
-- Skips pairs whose photos haven't changed since last time.
-- max_seconds = stop starting new pairs after this long (null = no limit).
drop function if exists private.match_user(uuid);
create function private.match_user(uid uuid, max_seconds int default null)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  fp text;
  deadline timestamptz := case when max_seconds is null then null else clock_timestamp() + make_interval(secs => max_seconds) end;
  total int := 0;
begin
  for c in select other from private.match_candidates(uid) loop
    if deadline is not null and clock_timestamp() > deadline then
      exit;
    end if;
    fp := private.pair_fingerprint(uid, c.other);
    if exists (select 1 from private.match_runs r
               where r.user_a = least(uid, c.other) and r.user_b = greatest(uid, c.other)
                 and r.fingerprint = fp) then
      continue;
    end if;
    total := total + private.match_pair(uid, c.other);
    insert into private.match_runs (user_a, user_b, fingerprint, matched_at)
    values (least(uid, c.other), greatest(uid, c.other), fp, now())
    on conflict (user_a, user_b) do update set fingerprint = excluded.fingerprint, matched_at = now();
  end loop;

  -- people who are no longer friends (or friends of friends) lose their near misses
  delete from public.near_misses nm
  where uid in (nm.user_a, nm.user_b)
    and (case when nm.user_a = uid then nm.user_b else nm.user_a end) not in (select other from private.match_candidates(uid));
  return total;
end $$;
revoke execute on function private.match_user(uuid, int) from public, anon, authenticated;

-- Adding or removing a friend just marks the pair as needing a match. The app calls
-- refresh_my_near_misses right afterwards, so nothing is done inside the friend request itself.
create or replace function private.on_friendship_change()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  x uuid;
  y uuid;
begin
  if tg_op = 'DELETE' then x := old.user_a; y := old.user_b;
  else x := new.user_a; y := new.user_b;
  end if;

  delete from private.match_runs r where r.user_a = least(x, y) and r.user_b = greatest(x, y);

  if tg_op = 'DELETE' then
    delete from public.near_misses nm where nm.user_a = least(x, y) and nm.user_b = greatest(x, y);
  end if;
  return null;
end $$;

-- What the app calls after a scan or a new friend.
create or replace function public.refresh_my_near_misses()
returns int
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform set_config('statement_timeout', '60s', true);
  return private.match_user(uid, 45);
end $$;
revoke execute on function public.refresh_my_near_misses() from public, anon;
grant execute on function public.refresh_my_near_misses() to authenticated;

-- How many of your pairs still need matching (0 means the feed is up to date).
create or replace function public.my_pending_matches()
returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int
  from private.match_candidates((select auth.uid())) c
  where not exists (
    select 1 from private.match_runs r
    where r.user_a = least((select auth.uid()), c.other)
      and r.user_b = greatest((select auth.uid()), c.other)
      and r.fingerprint = private.pair_fingerprint((select auth.uid()), c.other)
  );
$$;
revoke execute on function public.my_pending_matches() from public, anon;
grant execute on function public.my_pending_matches() to authenticated;

create or replace function private.match_everyone()
returns int
language plpgsql security definer set search_path = '' as $$
declare
  u record;
  total int := 0;
begin
  perform set_config('statement_timeout', '0', true);
  for u in select distinct user_id from public.location_points loop
    total := total + private.match_user(u.user_id);
  end loop;
  return total;
end $$;
