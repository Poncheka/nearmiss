-- Near Miss core schema
create extension if not exists postgis with schema extensions;
create extension if not exists citext with schema extensions;

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- people ----------
-- Public profile fields (visible to signed-in users for friend search)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext unique check (username ~ '^[a-z0-9_.]{3,24}$'),
  name text check (char_length(name) <= 60),
  bio text check (char_length(bio) <= 120),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Private settings (owner only)
create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  audience text not null default 'fof' check (audience in ('friends', 'fof', 'everyone')),
  delay_days int not null default 3 check (delay_days in (3, 7, 14, 30)),
  background_location boolean not null default false,
  notify_photos boolean not null default true,
  notify_replies boolean not null default true,
  notify_joins boolean not null default true,
  notify_weekly_report boolean not null default true,
  notify_on_this_day boolean not null default false,
  push_token text,
  onboarded_at timestamptz,
  updated_at timestamptz not null default now(),
  -- public matching always waits at least a week
  constraint everyone_min_delay check (audience <> 'everyone' or delay_days >= 7)
);
create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

-- Create profile + settings rows when someone signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'));
  insert into public.user_settings (user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.hidden_zones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null check (char_length(label) <= 40),
  center extensions.geography(point, 4326) not null,
  radius_m int not null default 300 check (radius_m between 50 and 2000),
  created_at timestamptz not null default now()
);
create index hidden_zones_user_idx on public.hidden_zones (user_id);

-- Hashed phone numbers / emails for contact matching (never raw)
create table public.contact_hashes (
  user_id uuid not null references auth.users (id) on delete cascade,
  hash text not null,
  is_self boolean not null default false, -- true = this user's own phone/email
  primary key (user_id, hash)
);
create index contact_hashes_hash_idx on public.contact_hashes (hash);

-- ---------- location ----------
create table public.location_points (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null,
  geom extensions.geography(point, 4326) not null,
  source text not null check (source in ('photo', 'background')),
  asset_id text, -- on-device photo id; the photo itself never leaves the phone
  created_at timestamptz not null default now(),
  unique (user_id, source, asset_id)
);
create index location_points_user_at_idx on public.location_points (user_id, at);
create index location_points_geom_idx on public.location_points using gist (geom);

-- Clusters of points (~100m, ~15 min)
create table public.moments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  centroid extensions.geography(point, 4326) not null,
  point_count int not null default 1,
  cover_asset_id text,
  source text not null check (source in ('photo', 'background')),
  created_at timestamptz not null default now(),
  check (end_at >= start_at)
);
create index moments_user_time_idx on public.moments (user_id, start_at);
create index moments_centroid_idx on public.moments using gist (centroid);

-- ---------- social ----------
create table public.friendships (
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  met_on date,
  met_on_source text not null default 'auto' check (met_on_source in ('auto', 'user')),
  met_on_set_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_a, user_b),
  check (user_a < user_b),
  check (requested_by in (user_a, user_b))
);
create index friendships_user_b_idx on public.friendships (user_b);

create table public.near_misses (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  moment_a uuid references public.moments (id) on delete set null,
  moment_b uuid references public.moments (id) on delete set null,
  closest_at timestamptz not null,
  night date not null, -- one near miss per pair per night
  distance_m int not null check (distance_m >= 0),
  place_name text,
  source text not null check (source in ('photo', 'background')),
  is_before_met boolean not null default false,
  surprise_score real not null default 0,
  visible_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b, night)
);
create index near_misses_user_a_idx on public.near_misses (user_a, visible_after);
create index near_misses_user_b_idx on public.near_misses (user_b, visible_after);

create table public.shared_photos (
  id uuid primary key default gen_random_uuid(),
  near_miss_id uuid not null references public.near_misses (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index shared_photos_nm_idx on public.shared_photos (near_miss_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  near_miss_id uuid not null references public.near_misses (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index comments_nm_idx on public.comments (near_miss_id, created_at);

create table public.read_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  near_miss_id uuid not null references public.near_misses (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, near_miss_id)
);

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade, -- recipient
  actor_id uuid references auth.users (id) on delete cascade,
  type text not null check (type in ('photo_shared', 'reply', 'friend_joined', 'invite_joined', 'met_changed', 'fof_near_miss', 'weekly_report', 'on_this_day')),
  near_miss_id uuid references public.near_misses (id) on delete cascade,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index activity_user_idx on public.activity (user_id, created_at desc);

create table public.match_feedback (
  user_id uuid not null references auth.users (id) on delete cascade,
  near_miss_id uuid not null references public.near_misses (id) on delete cascade,
  kind text not null check (kind in ('together', 'not_interesting', 'hide_place')),
  created_at timestamptz not null default now(),
  primary key (user_id, near_miss_id)
);

create table public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reported_user_id uuid references auth.users (id) on delete set null,
  comment_id uuid references public.comments (id) on delete set null,
  reason text check (char_length(reason) <= 500),
  created_at timestamptz not null default now()
);
;
