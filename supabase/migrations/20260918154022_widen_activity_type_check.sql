-- The activity triggers added in 20260918060000 write 'comment', 'friend_request',
-- 'friend_accepted' and 'near_miss', but this check constraint still listed only the types
-- from the original sketch. Every comment insert failed at the trigger, which surfaced in the
-- app as "Couldn't send" on a perfectly good comment.
--
-- The old names stay in the list: nothing writes them now, but rows already carrying them
-- would fail validation and block the ALTER.
alter table public.activity drop constraint if exists activity_type_check;

alter table public.activity add constraint activity_type_check check (type = any (array[
  -- written by the triggers as they stand
  'comment',
  'friend_request',
  'friend_accepted',
  'near_miss',
  'photo_shared',
  -- kept so existing rows still validate
  'reply',
  'friend_joined',
  'invite_joined',
  'met_changed',
  'fof_near_miss',
  'weekly_report',
  'on_this_day'
]));;
