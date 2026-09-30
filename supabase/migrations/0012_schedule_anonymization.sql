-- Runs the wipe from migration 0011 twice a day, inside the database:
-- once in the middle of the day and once at night after closing. Pick the
-- times below (pg_cron works in UTC; Athens is UTC+3 in summer, UTC+2 in
-- winter, so these land an hour earlier on the clock after the October
-- clock change):
--   11:00 UTC = 14:00 Athens (summer)
--   20:30 UTC = 23:30 Athens (summer)
--
-- Safe to run again: it replaces any earlier schedule of the same job.
-- If "create extension" is refused, enable pg_cron from the dashboard
-- (Database -> Extensions -> pg_cron) and run the statements after it.
create extension if not exists pg_cron with schema pg_catalog;

-- The earlier version of this migration ran it every 10 minutes.
select cron.unschedule(jobid) from cron.job where jobname = 'anonymize-past-appointments';

select cron.schedule('anonymize-appointments-midday', '0 11 * * *', $$select public.anonymize_past_appointments()$$);
select cron.schedule('anonymize-appointments-night', '30 20 * * *', $$select public.anonymize_past_appointments()$$);
