create or replace function private.on_friendship_activity()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.activity (user_id, actor_id, type)
    values (case when new.requested_by = new.user_a then new.user_b else new.user_a end,
            new.requested_by, 'friend_request');
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.activity (user_id, actor_id, type)
    values (new.requested_by,
            case when new.requested_by = new.user_a then new.user_b else new.user_a end,
            'friend_accepted');
  end if;
  return null;
end $$;

drop trigger if exists friendships_activity on public.friendships;
create trigger friendships_activity
  after insert or update on public.friendships
  for each row execute function private.on_friendship_activity();

create or replace function private.on_comment_activity()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  nm public.near_misses;
  other uuid;
begin
  select * into nm from public.near_misses where id = new.near_miss_id;
  if not found then return null; end if;
  other := case when nm.user_a = new.author_id then nm.user_b else nm.user_a end;
  if other = new.author_id then return null; end if;

  insert into public.activity (user_id, actor_id, type, near_miss_id, payload)
  values (other, new.author_id, 'comment', new.near_miss_id,
          jsonb_build_object('body', left(new.body, 140)));
  return null;
end $$;

drop trigger if exists comments_activity on public.comments;
create trigger comments_activity
  after insert on public.comments
  for each row execute function private.on_comment_activity();

create or replace function public.my_activity(limit_n int default 100)
returns table (
  id uuid, type text, actor_id uuid, actor_name text, actor_username text, actor_avatar_url text,
  near_miss_id uuid, place_name text, night date, body text,
  created_at timestamptz, read_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select a.id, a.type, a.actor_id, p.name, p.username::text, p.avatar_url,
         a.near_miss_id, nm.place_name, nm.night,
         a.payload->>'body',
         a.created_at, a.read_at
  from public.activity a
  left join public.profiles p on p.id = a.actor_id
  left join public.near_misses nm on nm.id = a.near_miss_id
  where a.user_id = (select auth.uid())
  order by a.created_at desc
  limit least(greatest(limit_n, 1), 200);
$$;
revoke execute on function public.my_activity(int) from public, anon;
grant execute on function public.my_activity(int) to authenticated;

create or replace function public.my_unread_activity()
returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.activity
  where user_id = (select auth.uid()) and read_at is null;
$$;
revoke execute on function public.my_unread_activity() from public, anon;
grant execute on function public.my_unread_activity() to authenticated;

create or replace function public.mark_activity_read()
returns void
language sql security definer set search_path = '' as $$
  update public.activity set read_at = now()
  where user_id = (select auth.uid()) and read_at is null;
$$;
revoke execute on function public.mark_activity_read() from public, anon;
grant execute on function public.mark_activity_read() to authenticated;

create index if not exists activity_user_created_idx on public.activity (user_id, created_at desc);
create index if not exists activity_user_unread_idx on public.activity (user_id) where read_at is null;;
