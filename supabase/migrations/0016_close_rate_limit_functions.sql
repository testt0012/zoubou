-- The per-IP rate-limit functions were callable by anyone holding the public
-- (anon) key — Supabase's default privileges hand new functions to the
-- anon/authenticated roles directly, so the "revoke from public" in
-- migrations 0003 and 0007 wasn't enough. That let a stranger fill someone
-- else's rate-limit budget (locking a customer out of booking) or flood the
-- tables. Only the server (service role) ever calls them.
revoke execute on function record_booking_attempt(text, int, int) from public, anon, authenticated;
revoke execute on function record_slots_attempt(text, int, int) from public, anon, authenticated;
grant execute on function record_booking_attempt(text, int, int) to service_role;
grant execute on function record_slots_attempt(text, int, int) to service_role;
