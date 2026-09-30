-- Customers' personal details are wiped once an hour has passed since their
-- appointment ended (the wipe itself runs twice a day — see migration 0012). The row itself stays (date, time, service, status) so the
-- appointment still counts in the occupancy reports.
--
-- WARNING: running this also wipes the names/phones of every appointment
-- that is already more than an hour in the past. That cannot be undone.
alter table appointments
  alter column first_name drop not null,
  alter column last_name drop not null;
-- (The CHECK constraints on first_name/last_name/mobile are unaffected:
-- a CHECK only rejects rows where it evaluates to FALSE, and is NULL for NULL.)

-- Appointment times are stored as Athens wall-clock date + time, so "an hour
-- after it ends" is worked out in that time zone. Applies to cancelled
-- appointments too. Returns how many rows it wiped.
create or replace function anonymize_past_appointments()
returns integer
language plpgsql
as $$
declare
  wiped integer;
begin
  update appointments
     set first_name = null,
         last_name = null,
         mobile = null,
         push_endpoint = null,
         push_p256dh = null,
         push_auth = null
   where (first_name is not null
          or last_name is not null
          or mobile is not null
          or push_endpoint is not null)
     and ((date + end_time) at time zone 'Europe/Athens') < now() - interval '1 hour';

  get diagnostics wiped = row_count;
  return wiped;
end;
$$;

-- Supabase's default privileges hand new functions to anon/authenticated
-- directly, so "from public" alone isn't enough.
revoke execute on function anonymize_past_appointments() from public, anon, authenticated;
grant execute on function anonymize_past_appointments() to service_role;

-- Wipe what is already past due right away.
select anonymize_past_appointments();
