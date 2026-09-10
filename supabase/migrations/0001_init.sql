-- Zoubou barber shop booking schema
-- Single admin (Supabase Auth user), anonymous public booking.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------
create table services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_minutes int not null check (duration_minutes > 0 and duration_minutes <= 480),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- availability_rules: recurring weekly working hours
-- weekday: 0 = Sunday ... 6 = Saturday (matches JS/Postgres extract(dow))
-- ---------------------------------------------------------------------------
create table availability_rules (
  id uuid primary key default gen_random_uuid(),
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  constraint availability_rules_valid_range check (end_time > start_time)
);

create index availability_rules_weekday_idx on availability_rules (weekday);

-- ---------------------------------------------------------------------------
-- blocked_slots: one-off closures (holidays, days off, partial blocks)
-- ---------------------------------------------------------------------------
create table blocked_slots (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  start_time time not null,
  end_time time not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint blocked_slots_valid_range check (end_time > start_time)
);

create index blocked_slots_date_idx on blocked_slots (date);

-- ---------------------------------------------------------------------------
-- settings: singleton row (slot grid granularity + buffer between bookings)
-- ---------------------------------------------------------------------------
create table settings (
  id boolean primary key default true check (id),
  slot_granularity_minutes int not null default 30 check (slot_granularity_minutes > 0 and slot_granularity_minutes <= 240),
  buffer_minutes int not null default 0 check (buffer_minutes >= 0 and buffer_minutes <= 120)
);

insert into settings (id) values (true);

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------
create table appointments (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services (id),
  date date not null,
  start_time time not null,
  end_time time not null,
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name text not null check (char_length(last_name) between 1 and 60),
  mobile text not null check (mobile ~ '^69[0-9]{8}$'),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint appointments_valid_range check (end_time > start_time),
  time_range tsrange generated always as (
    tsrange((date + start_time), (date + end_time), '[)')
  ) stored
);

create index appointments_date_idx on appointments (date);
create index appointments_service_idx on appointments (service_id);

-- The core race-condition guard: two CONFIRMED appointments can never occupy
-- overlapping time ranges, enforced atomically by Postgres itself. A second
-- concurrent booking attempt for the same/overlapping slot fails the insert
-- with an exclusion_violation (SQLSTATE 23P01), which the API turns into a
-- friendly "slot no longer available" response.
alter table appointments
  add constraint appointments_no_overlap
  exclude using gist (time_range with &&)
  where (status = 'confirmed');

-- ---------------------------------------------------------------------------
-- booking_rate_limits: lightweight per-IP abuse prevention log
-- ---------------------------------------------------------------------------
create table booking_rate_limits (
  id bigserial primary key,
  ip text not null,
  created_at timestamptz not null default now()
);

create index booking_rate_limits_ip_created_idx on booking_rate_limits (ip, created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- The public booking flow never talks to Supabase directly: it goes through
-- Next.js server routes using the service_role key (which bypasses RLS after
-- the API has validated/rate-limited the request). The browser only ever
-- holds the anon key, and the anon role has NO policies below, so it has
-- zero direct table access. The single admin account authenticates via
-- Supabase Auth and is granted full access as the "authenticated" role.
-- ---------------------------------------------------------------------------
alter table services enable row level security;
alter table availability_rules enable row level security;
alter table blocked_slots enable row level security;
alter table settings enable row level security;
alter table appointments enable row level security;
alter table booking_rate_limits enable row level security;

create policy "admin_full_access" on services for all to authenticated using (true) with check (true);
create policy "admin_full_access" on availability_rules for all to authenticated using (true) with check (true);
create policy "admin_full_access" on blocked_slots for all to authenticated using (true) with check (true);
create policy "admin_full_access" on settings for all to authenticated using (true) with check (true);
create policy "admin_full_access" on appointments for all to authenticated using (true) with check (true);

-- The shop currently offers one service; more can be added anytime from the
-- admin "Υπηρεσίες" page.
insert into services (name, duration_minutes, sort_order) values
  ('Κούρεμα', 30, 1);

-- Test availability: open every day 09:00-17:00. Adjust anytime from the
-- admin "Διαθεσιμότητα" page.
insert into availability_rules (weekday, start_time, end_time)
select weekday, '09:00', '17:00'
from generate_series(0, 6) as weekday;
