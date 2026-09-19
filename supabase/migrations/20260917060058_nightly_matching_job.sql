-- Run matching for everyone every night at 10:00 UTC (3am Pacific), so near misses appear
-- automatically as photos pass the 30-day mark.
create extension if not exists pg_cron;
select cron.schedule('nightly-near-miss-matching', '0 10 * * *', $$select private.match_everyone()$$);
;
