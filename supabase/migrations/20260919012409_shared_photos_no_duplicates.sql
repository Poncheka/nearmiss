-- The same photo could be shared to the same near miss over and over.
--
-- Each share wrote a new storage path stamped with the time, so nothing ever looked like a
-- duplicate to the database, and the carousel filled up with the same picture. Recording which
-- photo on the phone it came from is what makes "already shared" a question we can answer.
alter table public.shared_photos add column if not exists asset_id text;

comment on column public.shared_photos.asset_id is
  'The phone''s local asset id for the photo, so the same one cannot be shared twice to one near miss.';

-- Only constrains rows that carry an asset id, so anything shared before this stays put.
create unique index if not exists shared_photos_one_per_asset
  on public.shared_photos (near_miss_id, owner_id, asset_id)
  where asset_id is not null;;
