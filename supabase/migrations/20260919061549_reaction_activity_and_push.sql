-- Tell the other person a reaction happened, but only the first time.
--
-- Changing your mind from a heart to a laugh is an update, not an insert, so it never pings
-- them again. That is on purpose: the second thought is for you, not for them.

alter table public.activity drop constraint if exists activity_type_check;
alter table public.activity add constraint activity_type_check check (type = any (array[
  'comment', 'friend_request', 'friend_accepted', 'near_miss', 'photo_shared', 'reply',
  'friend_joined', 'invite_joined', 'met_changed', 'fof_near_miss', 'weekly_report',
  'on_this_day', 'reaction'
]));

create or replace function private.on_reaction_activity()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  nm public.near_misses;
  owner uuid;
begin
  select * into nm from public.near_misses where id = new.near_miss_id;
  if not found then return null; end if;

  -- Whoever made the thing being reacted to, which is not always the other person: you can
  -- react to your own photo, and nobody needs telling about that.
  if new.target_type = 'comment' then
    select c.author_id into owner from public.near_miss_comments c where c.id = new.target_id;
  else
    select s.owner_id into owner from public.shared_photos s where s.id = new.target_id;
  end if;

  if owner is null or owner = new.user_id then return null; end if;

  insert into public.activity (user_id, actor_id, type, near_miss_id, payload)
  values (owner, new.user_id, 'reaction', new.near_miss_id,
          jsonb_build_object('emoji', new.emoji, 'target', new.target_type));
  return null;
end $$;

drop trigger if exists reactions_activity on public.reactions;
create trigger reactions_activity
  after insert on public.reactions
  for each row execute function private.on_reaction_activity();

-- The push copy. Reactions follow the reply switch, since that is the same conversation.
create or replace function private.push_for_activity()
returns trigger
language plpgsql security definer set search_path = '' as $$
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
           when 'reaction' then coalesce(s.notify_replies, true)
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
    when 'reaction' then
      title := actor || ' reacted ' || coalesce(new.payload->>'emoji', '');
      body := case when new.payload->>'target' = 'photo'
                   then 'To your photo from ' || place || '.'
                   else 'To what you said about ' || place || '.' end;
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
