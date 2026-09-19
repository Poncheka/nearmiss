-- The comments table is public.comments, not public.near_miss_comments. Both functions that
-- checked a reaction's target were pointing at a table that does not exist, so every reaction
-- to a message would have failed and every reaction to a photo would have notified nobody.
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

  if t_type = 'comment' then
    if not exists (select 1 from public.comments c
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

create or replace function private.on_reaction_activity()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  owner uuid;
begin
  if new.target_type = 'comment' then
    select c.author_id into owner from public.comments c where c.id = new.target_id;
  else
    select s.owner_id into owner from public.shared_photos s where s.id = new.target_id;
  end if;

  if owner is null or owner = new.user_id then return null; end if;

  insert into public.activity (user_id, actor_id, type, near_miss_id, payload)
  values (owner, new.user_id, 'reaction', new.near_miss_id,
          jsonb_build_object('emoji', new.emoji, 'target', new.target_type));
  return null;
end $$;;
