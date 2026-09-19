-- Where to send a push, per device.
--
-- One row per device, not per person: phone and iPad get their own, and a token that Expo tells
-- us is dead gets removed rather than retried forever.
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- You can register and remove your own; nobody can read anyone else's. The sender runs with the
-- service role and bypasses this.
create policy "own tokens readable" on public.push_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own tokens insertable" on public.push_tokens
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own tokens updatable" on public.push_tokens
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own tokens deletable" on public.push_tokens
  for delete to authenticated using (user_id = (select auth.uid()));

-- Registering is an upsert: the same token can move between accounts when someone signs out and
-- a different person signs in on that phone, and the newest owner wins.
create or replace function public.register_push_token(t text, plat text)
returns void language sql security definer set search_path to '' as $$
  insert into public.push_tokens (token, user_id, platform, last_seen_at)
  values (t, (select auth.uid()), plat, now())
  on conflict (token) do update
    set user_id = (select auth.uid()), platform = excluded.platform, last_seen_at = now();
$$;

grant execute on function public.register_push_token(text, text) to authenticated;

-- Which activity rows have not been pushed yet. The sender marks them as it goes, so a retry or
-- an overlapping run cannot send the same thing twice.
alter table public.activity add column if not exists pushed_at timestamptz;

create index if not exists activity_unpushed_idx on public.activity (created_at)
  where pushed_at is null;;
