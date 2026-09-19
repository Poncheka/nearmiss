-- Flagging runs before matching, so a photo someone sent you is caught the first time rather
-- than after it has already produced a near miss.
--
-- It is cheap relative to matching and only rewrites rows whose answer changed, so doing it on
-- every refresh costs almost nothing once the library has settled.
create or replace function public.refresh_my_near_misses()
returns integer language plpgsql security definer set search_path to '' as $function$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform set_config('statement_timeout', '60s', true);
  perform private.flag_isolated_points(uid);
  return private.match_user(uid, 45);
end $function$;;
