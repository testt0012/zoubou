-- One frozen row per finished day: the hours the shop was open and the
-- hours that were booked (regular customers included). The reports read
-- past days from here instead of recomputing them from today's weekly
-- hours and today's regular customers, which would rewrite history every
-- time either of those changes.
--
-- Filled by the nightly job /api/cron/daily-stats (vercel.json), which also
-- backfills any day it missed — starting, the first time, from the earliest
-- appointment on record.
create table daily_stats (
  date date primary key,
  working_minutes int not null check (working_minutes >= 0),
  booked_minutes int not null check (booked_minutes >= 0),
  created_at timestamptz not null default now()
);

alter table daily_stats enable row level security;

-- The admin reads it from the browser; only the server (service role,
-- which bypasses RLS) writes it.
create policy "admin_read" on daily_stats for select to authenticated using (is_admin());
revoke all on daily_stats from anon;
