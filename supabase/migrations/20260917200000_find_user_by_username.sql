-- Add someone by their exact @username (profiles stay private: this only answers for an exact match,
-- never a partial one, so nobody can browse the user list).
create or replace function public.find_user_by_username(handle text)
returns table (id uuid, username text, name text, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username::text, p.name, p.avatar_url
  from public.profiles p
  where p.username = lower(trim(both '@ ' from handle))::extensions.citext
    and p.id <> (select auth.uid())
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = p.id and b.blocked_id = (select auth.uid()))
         or (b.blocked_id = p.id and b.blocker_id = (select auth.uid()))
    )
  limit 1;
$$;
revoke execute on function public.find_user_by_username(text) from public, anon;
grant execute on function public.find_user_by_username(text) to authenticated;
