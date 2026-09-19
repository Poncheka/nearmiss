-- A reaction's payload holds the emoji, not a body, and the activity list only reads 'body'.
-- Rather than add a column for one type, let body be whatever that type's message is.
create or replace function public.my_activity(limit_n int default 50)
returns table (
  id uuid, type text, actor_id uuid, actor_name text, actor_username text, actor_avatar_url text,
  near_miss_id uuid, place_name text, night date, body text,
  created_at timestamptz, read_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select a.id, a.type, a.actor_id, p.name, p.username::text, p.avatar_url,
         a.near_miss_id, nm.place_name, nm.night,
         coalesce(a.payload->>'body', a.payload->>'emoji'),
         a.created_at, a.read_at
  from public.activity a
  left join public.profiles p on p.id = a.actor_id
  left join public.near_misses nm on nm.id = a.near_miss_id
  where a.user_id = (select auth.uid())
  order by a.created_at desc
  limit least(greatest(limit_n, 1), 200);
$$;
revoke execute on function public.my_activity(int) from public, anon;
grant execute on function public.my_activity(int) to authenticated;;
