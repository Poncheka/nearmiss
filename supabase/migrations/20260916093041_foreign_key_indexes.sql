-- Indexes for foreign keys (keeps deletes and joins fast)
create index if not exists activity_actor_idx on public.activity (actor_id);
create index if not exists activity_near_miss_idx on public.activity (near_miss_id);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);
create index if not exists comments_author_idx on public.comments (author_id);
create index if not exists friendships_met_on_set_by_idx on public.friendships (met_on_set_by);
create index if not exists friendships_requested_by_idx on public.friendships (requested_by);
create index if not exists match_feedback_near_miss_idx on public.match_feedback (near_miss_id);
create index if not exists near_misses_moment_a_idx on public.near_misses (moment_a);
create index if not exists near_misses_moment_b_idx on public.near_misses (moment_b);
create index if not exists read_state_near_miss_idx on public.read_state (near_miss_id);
create index if not exists reports_comment_idx on public.reports (comment_id);
create index if not exists reports_reported_user_idx on public.reports (reported_user_id);
create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists shared_photos_owner_idx on public.shared_photos (owner_id);
;
