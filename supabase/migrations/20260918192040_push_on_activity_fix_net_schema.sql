-- pg_net installs its functions into the `net` schema whatever schema you name in CREATE
-- EXTENSION, so the previous version referenced a function that does not exist. It never threw,
-- because the only account on file had no push tokens and the function returned before reaching
-- it. It would have started failing on the first real device.
create or replace function private.push_for_activity()
returns trigger language plpgsql security definer set search_path to '' as $$
declare
  actor text;
  place text;
  wanted boolean;
  title text;
  body text;
  tokens text[];
begin
  if new.actor_id = new.user_id then return null; end if;

  select coalesce(split_part(p.name, ' ', 1), '@' || p.username, 'Someone')
    into actor from public.profiles p where p.id = new.actor_id;
  actor := coalesce(actor, 'Someone');

  select coalesce(n.place_name, 'that day')
    into place from public.near_misses n where n.id = new.near_miss_id;
  place := coalesce(place, 'that day');

  select case new.type
           when 'comment' then coalesce(s.notify_replies, true)
           when 'photo_shared' then coalesce(s.notify_photos, true)
           when 'near_miss' then coalesce(s.notify_near_misses, true)
           when 'friend_request' then coalesce(s.notify_joins, true)
           when 'friend_accepted' then coalesce(s.notify_joins, true)
           else false
         end
    into wanted
  from (select 1) x
  left join public.user_settings s on s.user_id = new.user_id;

  if not coalesce(wanted, true) then return null; end if;

  case new.type
    when 'comment' then
      title := actor || ' replied';
      body := coalesce(new.payload->>'body', 'about ' || place);
    when 'photo_shared' then
      title := actor || ' shared a photo';
      body := 'From ' || place || '.';
    when 'near_miss' then
      title := 'You and ' || actor || ' nearly crossed paths';
      body := 'At ' || place || '.';
    when 'friend_request' then
      title := actor || ' wants to find near misses with you';
      body := 'Tap to accept.';
    when 'friend_accepted' then
      title := actor || ' is on Near Miss with you';
      body := 'Near misses between you will show up as they are found.';
    else
      return null;
  end case;

  select array_agg(t.token) into tokens
  from public.push_tokens t where t.user_id = new.user_id;

  if tokens is null or array_length(tokens, 1) = 0 then return null; end if;

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := (
      select jsonb_agg(jsonb_build_object(
        'to', tok,
        'title', title,
        'body', left(body, 140),
        'sound', 'default',
        'badge', (select count(*) from public.activity a
                   where a.user_id = new.user_id and a.read_at is null),
        'data', jsonb_build_object('nearMissId', new.near_miss_id, 'type', new.type)
      ))
      from unnest(tokens) as tok
    )
  );

  update public.activity set pushed_at = now() where id = new.id;
  return null;
end $$;;
