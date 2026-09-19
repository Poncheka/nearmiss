-- Friends only, by default.
--
-- Friend-of-a-friend works: match_candidates walks the graph and near misses found that way
-- carry the "via" name. But it means someone you have never met can be told where you were, and
-- that should be a choice people make rather than one they discover. The setting stays; only the
-- starting point changes.
alter table public.user_settings alter column audience set default 'friends';

-- Existing accounts keep whatever they have. Only the two testers are on 'fof' by default rather
-- than by choice, and flipping their setting under them would be its own surprise.

-- Telling the other person when you set the date you met.
--
-- One person answering "when did you two meet" relabels the whole shared feed: near misses move
-- between "before you met" and everything after. The other person watches their feed rearrange
-- with no idea why.
create or replace function private.on_met_on_activity()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  other uuid;
begin
  -- Only when the date actually changes, and only when someone set one.
  if new.met_on is null or new.met_on is not distinct from old.met_on then return null; end if;

  other := case when new.user_a = (select auth.uid()) then new.user_b else new.user_a end;
  if other is null or other = (select auth.uid()) then return null; end if;

  insert into public.activity (user_id, actor_id, type, payload)
  values (other, (select auth.uid()), 'met_changed',
          jsonb_build_object('met_on', new.met_on));
  return null;
end $$;

drop trigger if exists friendships_met_on_activity on public.friendships;
create trigger friendships_met_on_activity
  after update of met_on on public.friendships
  for each row execute function private.on_met_on_activity();;
