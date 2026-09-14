-- Same atomic per-IP rate limiting as booking_rate_limits (migration 0003),
-- but for the read-only GET /api/slots endpoint. Kept as its own
-- table/function rather than reusing booking_rate_limits so a customer
-- browsing dates/times doesn't burn through their actual booking-attempt
-- budget — slot browsing gets its own, more generous limit.

create table slots_rate_limits (
  id bigserial primary key,
  ip text not null,
  created_at timestamptz not null default now()
);

create index slots_rate_limits_ip_created_idx on slots_rate_limits (ip, created_at);

alter table slots_rate_limits enable row level security;

create or replace function record_slots_attempt(
  p_ip text,
  p_window_minutes int,
  p_max_attempts int
)
returns boolean
language plpgsql
as $$
declare
  attempt_count int;
begin
  perform pg_advisory_xact_lock(hashtext('slots:' || p_ip));

  select count(*) into attempt_count
  from slots_rate_limits
  where ip = p_ip
    and created_at >= now() - (p_window_minutes || ' minutes')::interval;

  if attempt_count >= p_max_attempts then
    return false;
  end if;

  insert into slots_rate_limits (ip) values (p_ip);

  -- Opportunistic cleanup, same approach as record_booking_attempt.
  if random() < 0.01 then
    delete from slots_rate_limits where created_at < now() - interval '1 day';
  end if;

  return true;
end;
$$;

revoke execute on function record_slots_attempt(text, int, int) from public;
grant execute on function record_slots_attempt(text, int, int) to service_role;
