-- Marking a single notification read.
--
-- Opening one and having it stay bold is the kind of small wrongness that makes a list feel
-- broken. "Mark all read" was the only option, which is a blunt instrument when you have read
-- exactly one thing.
create or replace function public.mark_activity_read_one(a_id uuid)
returns void language sql security definer set search_path to '' as $$
  update public.activity
  set read_at = now()
  where id = a_id and user_id = (select auth.uid()) and read_at is null;
$$;

grant execute on function public.mark_activity_read_one(uuid) to authenticated;;
