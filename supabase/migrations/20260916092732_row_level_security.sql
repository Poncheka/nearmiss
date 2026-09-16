-- Who can see and change what. Every table is locked down; access is granted explicitly.

-- Is the signed-in user one of the two people in this near miss (and is it past its delay)?
create or replace function public.is_near_miss_participant(nm_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.near_misses n
    where n.id = nm_id
      and (select auth.uid()) in (n.user_a, n.user_b)
      and n.visible_after <= now()
  );
$$;
revoke execute on function public.is_near_miss_participant(uuid) from anon;

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.hidden_zones enable row level security;
alter table public.contact_hashes enable row level security;
alter table public.location_points enable row level security;
alter table public.moments enable row level security;
alter table public.friendships enable row level security;
alter table public.near_misses enable row level security;
alter table public.shared_photos enable row level security;
alter table public.comments enable row level security;
alter table public.read_state enable row level security;
alter table public.activity enable row level security;
alter table public.match_feedback enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

-- profiles: any signed-in user can read basic profile info; only you can edit yours
create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);
create policy "edit own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- owner-only tables
create policy "own settings" on public.user_settings
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own hidden zones" on public.hidden_zones
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own contact hashes" on public.contact_hashes
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own location points" on public.location_points
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own moments" on public.moments
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own read state" on public.read_state
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own blocks" on public.blocks
  for all to authenticated using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

-- friendships: both people can see and update; you can only create requests from yourself
create policy "see own friendships" on public.friendships
  for select to authenticated using ((select auth.uid()) in (user_a, user_b));
create policy "request friendship" on public.friendships
  for insert to authenticated with check (requested_by = (select auth.uid()) and (select auth.uid()) in (user_a, user_b));
create policy "update own friendships" on public.friendships
  for update to authenticated using ((select auth.uid()) in (user_a, user_b)) with check ((select auth.uid()) in (user_a, user_b));
create policy "remove own friendships" on public.friendships
  for delete to authenticated using ((select auth.uid()) in (user_a, user_b));

-- near misses: read-only for the two people, and only after the delay. Created by the matching function.
create policy "see own near misses" on public.near_misses
  for select to authenticated using ((select auth.uid()) in (user_a, user_b) and visible_after <= now());

-- shared photos & comments: only the two people in the near miss
create policy "see shared photos" on public.shared_photos
  for select to authenticated using (public.is_near_miss_participant(near_miss_id));
create policy "share own photos" on public.shared_photos
  for insert to authenticated with check (owner_id = (select auth.uid()) and public.is_near_miss_participant(near_miss_id));
create policy "unshare own photos" on public.shared_photos
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "see comments" on public.comments
  for select to authenticated using (public.is_near_miss_participant(near_miss_id));
create policy "write comments" on public.comments
  for insert to authenticated with check (author_id = (select auth.uid()) and public.is_near_miss_participant(near_miss_id));
create policy "delete own comments" on public.comments
  for delete to authenticated using (author_id = (select auth.uid()));

-- activity: recipients read and mark read
create policy "see own activity" on public.activity
  for select to authenticated using (user_id = (select auth.uid()));
create policy "mark own activity read" on public.activity
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- feedback on your own near misses
create policy "own feedback" on public.match_feedback
  for select to authenticated using (user_id = (select auth.uid()));
create policy "give feedback" on public.match_feedback
  for insert to authenticated with check (user_id = (select auth.uid()) and public.is_near_miss_participant(near_miss_id));
create policy "change feedback" on public.match_feedback
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- reports: file your own, see your own
create policy "file reports" on public.reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy "see own reports" on public.reports
  for select to authenticated using (reporter_id = (select auth.uid()));
