-- Server-side error log. The app records unexpected failures here (booking
-- and cancel/move errors, unreadable database answers, failed nightly jobs,
-- jobs that have silently stopped) — never customer names or phone numbers —
-- and sends an alert to the developer (see lib/errorLog.ts). The same error
-- repeating within 10 minutes is counted on one row instead of adding more.
-- Rows older than 30 days are removed by the nightly job.
create table error_log (
  id bigserial primary key,
  source text not null check (char_length(source) <= 100),
  message text not null check (char_length(message) <= 1000),
  detail jsonb,
  count int not null default 1,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index error_log_source_seen_idx on error_log (source, last_seen_at desc);
create index error_log_seen_idx on error_log (last_seen_at);

alter table error_log enable row level security;

-- The admin screen can report its own crashes using the admin session;
-- everything else writes with the server key, which bypasses RLS. Nobody
-- reads this through the app — look at it in the Supabase table editor.
create policy "admin_insert" on error_log for insert to authenticated with check (is_admin());
revoke all on error_log from anon;
