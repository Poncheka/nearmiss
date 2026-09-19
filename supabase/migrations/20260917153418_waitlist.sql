-- Coming-soon page sign-ups (nearmiss.io). Anyone can add an email; nobody can read the list
-- through the API (view it in the Supabase dashboard).
create table if not exists public.waitlist (
  id bigint generated always as identity primary key,
  email extensions.citext not null unique check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  invited_by text check (invited_by is null or invited_by ~ '^[a-z0-9_.]{1,24}$'),
  created_at timestamptz not null default now()
);
alter table public.waitlist enable row level security;
create policy "anyone can join the waitlist" on public.waitlist
  for insert to anon, authenticated with check (true);
grant insert on public.waitlist to anon, authenticated;
;
