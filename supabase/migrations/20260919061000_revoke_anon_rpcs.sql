-- Nine functions were still callable without signing in. They all read auth.uid(), so a
-- signed-out call does nothing useful, but several of them write, and an endpoint that only
-- fails safely by accident is not a closed door. Default privileges hand anon EXECUTE on
-- anything created in public, so a function recreated after its original revoke got it back.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in (
         'block_user', 'unblock_user', 'contacts_linked', 'my_blocks', 'unfriend',
         'unlink_my_contacts', 'mark_activity_read_one', 'register_push_token',
         'my_near_misses', 'near_miss_photos'
       )
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
