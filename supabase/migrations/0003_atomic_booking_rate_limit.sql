-- Atomic per-IP rate limiting for the public booking endpoint.
--
-- The previous approach (app does SELECT count(*) ... then INSERT) has a
-- check-then-act race: concurrent requests from the same IP can all pass
-- the count check before any of their inserts land, letting a burst exceed
-- the limit. This function does the check-and-record as one atomic unit,
-- serialized per IP with a transaction-scoped advisory lock so concurrent
-- calls for the same IP can't interleave.
create or replace function record_booking_attempt(
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
  perform pg_advisory_xact_lock(hashtext(p_ip));

  select count(*) into attempt_count
  from booking_rate_limits
  where ip = p_ip
    and created_at >= now() - (p_window_minutes || ' minutes')::interval;

  if attempt_count >= p_max_attempts then
    return false;
  end if;

  insert into booking_rate_limits (ip) values (p_ip);

  -- Opportunistic cleanup: on ~1% of calls, drop rows old enough that no
  -- rate-limit window could reference them anymore. Keeps this append-only
  -- log bounded without needing a separate cron job.
  if random() < 0.01 then
    delete from booking_rate_limits where created_at < now() - interval '1 day';
  end if;

  return true;
end;
$$;

-- Least privilege: only the service-role booking API should be able to
-- call this (it's the only caller, using the service_role key server-side).
revoke execute on function record_booking_attempt(text, int, int) from public;
grant execute on function record_booking_attempt(text, int, int) to service_role;
