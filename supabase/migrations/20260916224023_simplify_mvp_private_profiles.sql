-- MVP simplification:
-- 1. Near misses come only from photo history. No "recent" near misses, no user-chosen delay,
--    no background location. Photos from the last 30 days are never matched (enforced by the
--    matching function via visible_after = closest_at + 30 days).
-- 2. No public profiles. A profile is visible only to its owner, people you have a friendship
--    row with (pending or accepted), and people you share a near miss with.

-- settings: drop public audience, delay and background location
alter table public.user_settings drop constraint if exists everyone_min_delay;
update public.user_settings set audience = 'fof' where audience = 'everyone';
alter table public.user_settings drop constraint if exists user_settings_audience_check;
alter table public.user_settings add constraint user_settings_audience_check check (audience in ('friends', 'fof'));
alter table public.user_settings drop column if exists delay_days;
alter table public.user_settings drop column if exists background_location;

-- near misses and moments only come from photos now
alter table public.near_misses drop constraint if exists near_misses_source_check;
alter table public.near_misses add constraint near_misses_source_check check (source = 'photo');
alter table public.moments drop constraint if exists moments_source_check;
alter table public.moments add constraint moments_source_check check (source = 'photo');
alter table public.location_points drop constraint if exists location_points_source_check;
alter table public.location_points add constraint location_points_source_check check (source = 'photo');
alter table public.near_misses add constraint near_misses_not_recent check (visible_after >= closest_at + interval '30 days');

-- private profiles
create or replace function private.can_see_profile(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target = (select auth.uid())
    or exists (
      select 1 from public.friendships f
      where (f.user_a = target and f.user_b = (select auth.uid()))
         or (f.user_b = target and f.user_a = (select auth.uid()))
    )
    or exists (
      select 1 from public.near_misses n
      where ((n.user_a = target and n.user_b = (select auth.uid()))
          or (n.user_b = target and n.user_a = (select auth.uid())))
        and n.visible_after <= now()
    );
$$;
revoke execute on function private.can_see_profile(uuid) from public, anon;
grant execute on function private.can_see_profile(uuid) to authenticated;

drop policy if exists "profiles readable by signed-in users" on public.profiles;
create policy "see own, friends and near-miss profiles" on public.profiles
  for select to authenticated using (private.can_see_profile(id));

-- Friend discovery without public profiles: given hashed phone numbers / emails from the
-- caller's contacts, return only the people who registered one of those hashes as their own.
-- (Intentionally callable by signed-in users; returns nothing unless you already have their number/email.)
create or replace function public.find_contacts_on_app(hashes text[])
returns table (id uuid, username text, name text, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select distinct p.id, p.username::text, p.name, p.avatar_url
  from public.contact_hashes c
  join public.profiles p on p.id = c.user_id
  where c.is_self
    and c.hash = any (hashes[1:2000])
    and c.user_id <> (select auth.uid())
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = c.user_id and b.blocked_id = (select auth.uid()))
         or (b.blocked_id = c.user_id and b.blocker_id = (select auth.uid()))
    );
$$;
revoke execute on function public.find_contacts_on_app(text[]) from public, anon;
grant execute on function public.find_contacts_on_app(text[]) to authenticated;
