-- Regular ("μόνιμοι") customers: a standing visit every 1, 2 or 3 weeks on
-- the weekday of start_date, for one service.
--
--   zone_end_time is null  -> fixed time: start_time..start_time+duration is
--                             never offered to anyone else on those dates.
--   zone_end_time not null -> time zone start_time..zone_end_time: one
--                             opening for the customer is always kept free
--                             inside it (the last free slot in the zone
--                             stops being bookable).
--
-- Nothing is materialised into appointments — lib/slots.ts works the
-- reservations out per date (see lib/recurring.ts), so editing or deleting
-- a row takes effect everywhere at once.
create table recurring_customers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  mobile text,
  service_id uuid not null references services (id),
  start_date date not null,
  interval_weeks int not null check (interval_weeks between 1 and 3),
  start_time time not null,
  zone_end_time time,
  created_at timestamptz not null default now(),
  constraint recurring_customers_valid_zone check (zone_end_time is null or zone_end_time > start_time)
);

alter table recurring_customers enable row level security;

create policy "admin_full_access" on recurring_customers
  for all to authenticated using (is_admin()) with check (is_admin());

alter publication supabase_realtime add table recurring_customers;
