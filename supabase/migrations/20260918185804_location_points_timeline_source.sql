-- Location history imported from Google Timeline, alongside the points read from photos.
--
-- Only 'visit' segments are imported, never the movement traces: a visit is "you were at this
-- place from 7.10 to 9.40", which is the same shape as a run of photos and feeds the existing
-- stay matcher directly. Importing the path between visits would mean two cars passing on a
-- freeway counts as a near miss, which is true and worthless.
alter table public.location_points drop constraint if exists location_points_source_check;

alter table public.location_points
  add constraint location_points_source_check check (source in ('photo', 'timeline'));

-- asset_id already carries the uniqueness for photos (the local asset). Timeline points reuse
-- it with a synthetic key, so importing the same export twice is a no-op rather than a pile of
-- duplicates.
comment on column public.location_points.asset_id is
  'For source=photo, the phone''s local asset id. For source=timeline, "t:<unix seconds>" of the point.';;
