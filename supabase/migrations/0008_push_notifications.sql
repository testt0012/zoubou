-- Web Push support for two notifications:
--   1. A reminder to the customer 1 day before their appointment.
--   2. An alert to the admin whenever a new appointment comes in.
--
-- Customers never have an account, so there's nowhere to keep a standing
-- subscription for them — instead, the browser's push subscription (if they
-- opt in right after booking) is attached directly to that one appointment
-- row. The admin, by contrast, is a single authenticated user whose device(s)
-- can subscribe once and stay subscribed, so that gets its own small table.

alter table appointments
  add column push_endpoint text,
  add column push_p256dh text,
  add column push_auth text,
  add column reminder_sent boolean not null default false;

create table admin_push_subscriptions (
  id bigserial primary key,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table admin_push_subscriptions enable row level security;

create policy "admin_full_access" on admin_push_subscriptions for all to authenticated using (true) with check (true);
