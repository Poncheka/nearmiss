-- Reacting to a message or a photo on a near miss.
--
-- One reaction per person per thing, the way a tapback works, rather than a Slack-style pile.
-- Two people looking at one photo from a night in 2019 do not need a tally, they need the other
-- person to have said something without having to write it.
--
-- Everything is scoped to the near miss so the policies can reuse the participant check that
-- already guards the comments and the photos. There is no path to react to something on a near
-- miss you are not part of.

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  near_miss_id uuid not null references public.near_misses(id) on delete cascade,
  target_type text not null check (target_type in ('comment', 'photo')),
  target_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  unique (target_type, target_id, user_id)
);

create index if not exists reactions_target_idx on public.reactions (target_type, target_id);
create index if not exists reactions_near_miss_idx on public.reactions (near_miss_id);
create index if not exists reactions_user_idx on public.reactions (user_id);

alter table public.reactions enable row level security;

drop policy if exists reactions_read on public.reactions;
create policy reactions_read on public.reactions
  for select to authenticated
  using (private.is_near_miss_participant(near_miss_id));

drop policy if exists reactions_write on public.reactions;
create policy reactions_write on public.reactions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_near_miss_participant(near_miss_id));

drop policy if exists reactions_change on public.reactions;
create policy reactions_change on public.reactions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists reactions_remove on public.reactions;
create policy reactions_remove on public.reactions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- One call for all three outcomes: add it, swap it, or take it back by tapping the same one.
-- Returns the emoji that is now yours, or null if you removed it, so the client doesn't have to
-- guess which of the three happened.
create or replace function public.react(
  nm_id uuid, t_type text, t_id uuid, e text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  current text;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if not private.is_near_miss_participant(nm_id) then
    raise exception 'Not your near miss';
  end if;
  if t_type not in ('comment', 'photo') then
    raise exception 'Unknown target';
  end if;

  -- The target has to actually sit on this near miss, or a reaction could be filed against
  -- someone else's photo by passing its id here.
  if t_type = 'comment' then
    if not exists (select 1 from public.near_miss_comments c
                    where c.id = t_id and c.near_miss_id = nm_id) then
      raise exception 'No such message';
    end if;
  else
    if not exists (select 1 from public.shared_photos s
                    where s.id = t_id and s.near_miss_id = nm_id) then
      raise exception 'No such photo';
    end if;
  end if;

  select r.emoji into current from public.reactions r
   where r.target_type = t_type and r.target_id = t_id and r.user_id = me;

  if current = e then
    delete from public.reactions r
     where r.target_type = t_type and r.target_id = t_id and r.user_id = me;
    return null;
  end if;

  insert into public.reactions (near_miss_id, target_type, target_id, user_id, emoji)
  values (nm_id, t_type, t_id, me, e)
  on conflict (target_type, target_id, user_id)
  do update set emoji = excluded.emoji, created_at = now();

  return e;
end $$;
revoke execute on function public.react(uuid, text, uuid, text) from public, anon;
grant execute on function public.react(uuid, text, uuid, text) to authenticated;

-- Every reaction on one near miss, in one round trip. The thread and the carousel both need
-- them, and fetching per item would be a request per message.
create or replace function public.near_miss_reactions(nm_id uuid)
returns table (target_type text, target_id uuid, user_id uuid, emoji text, mine boolean)
language sql stable security definer set search_path = '' as $$
  select r.target_type, r.target_id, r.user_id, r.emoji,
         r.user_id = (select auth.uid())
    from public.reactions r
   where r.near_miss_id = nm_id
     and private.is_near_miss_participant(nm_id)
   order by r.created_at;
$$;
revoke execute on function public.near_miss_reactions(uuid) from public, anon;
grant execute on function public.near_miss_reactions(uuid) to authenticated;;
