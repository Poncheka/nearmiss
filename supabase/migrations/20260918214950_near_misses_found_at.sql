-- Two different questions, two different orders.
--
-- "When did this happen" is closest_at, which is what the timeline reads. "When did we find it"
-- is created_at, which is what you want when a friend joins and twenty years of near misses
-- arrive at once. The feed could not offer the second because it never had the column.
drop function if exists public.my_near_misses();

create function public.my_near_misses()
returns table(id uuid, other_id uuid, other_username text, other_name text, other_avatar_url text,
              other_birthday date,
              via_id uuid, via_name text, closest_at timestamptz, night date, distance_m integer,
              place_name text, kind text, overlap_min integer,
              my_lat double precision, my_lng double precision,
              their_lat double precision, their_lng double precision,
              is_before_met boolean, is_new boolean, comment_count bigint, unread_count bigint,
              visible_after timestamptz, found_at timestamptz)
language sql stable security definer set search_path to ''
as $function$
  with me as (select (select auth.uid()) as uid),
  mine as (
    select n.*, case when n.user_a = me.uid then n.user_b else n.user_a end as other,
           case when n.user_a = me.uid then n.point_a else n.point_b end as my_pt,
           case when n.user_a = me.uid then n.point_b else n.point_a end as their_pt
    from public.near_misses n, me
    where me.uid in (n.user_a, n.user_b) and n.visible_after <= now()
      and not exists (select 1 from public.match_feedback f where f.near_miss_id = n.id and f.user_id = me.uid and f.kind in ('together', 'not_interesting'))
  ),
  cands as (select * from private.match_candidates((select uid from me)))
  select m.id, m.other, p.username::text, p.name, p.avatar_url,
         p.birthday,
         c.via, vp.name,
         m.closest_at, m.night, m.distance_m, m.place_name,
         m.kind, m.overlap_min,
         extensions.st_y(m.my_pt::extensions.geometry), extensions.st_x(m.my_pt::extensions.geometry),
         extensions.st_y(m.their_pt::extensions.geometry), extensions.st_x(m.their_pt::extensions.geometry),
         m.is_before_met,
         rs.last_read_at is null,
         (select count(*) from public.comments cm where cm.near_miss_id = m.id),
         (select count(*) from public.comments cm where cm.near_miss_id = m.id
            and cm.author_id <> (select uid from me)
            and cm.created_at > coalesce(rs.last_read_at, '-infinity'::timestamptz)),
         m.visible_after,
         m.created_at
  from mine m
  left join public.profiles p on p.id = m.other
  left join cands c on c.other = m.other
  left join public.profiles vp on vp.id = c.via
  left join public.read_state rs on rs.near_miss_id = m.id and rs.user_id = (select uid from me)
  order by m.closest_at;
$function$;

grant execute on function public.my_near_misses() to authenticated;;
