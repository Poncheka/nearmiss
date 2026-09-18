-- Tell people when new near misses turn up.
--
-- Carefully: matching a new friend produced 39 rows at once for the first real pair. Nobody
-- wants 39 notifications. One row per pair per half-day, and the app says "new near misses"
-- rather than naming one, so the count can't go stale.
create or replace function private.on_near_miss_activity()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  actor uuid;
begin
  -- Only worth telling someone about once it is actually visible to them.
  if new.visible_after > now() then return null; end if;

  foreach target in array array[new.user_a, new.user_b] loop
    actor := case when target = new.user_a then new.user_b else new.user_a end;

    if exists (
      select 1 from public.activity a
      where a.user_id = target and a.actor_id = actor and a.type = 'near_miss'
        and a.created_at > now() - interval '12 hours'
    ) then
      continue;
    end if;

    insert into public.activity (user_id, actor_id, type, near_miss_id)
    values (target, actor, 'near_miss', new.id);
  end loop;
  return null;
end $$;

drop trigger if exists near_misses_activity on public.near_misses;
create trigger near_misses_activity
  after insert on public.near_misses
  for each row execute function private.on_near_miss_activity();
