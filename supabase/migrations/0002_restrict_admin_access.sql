-- Supabase projects allow public email signups by default. Since the
-- original policies below grant every "authenticated" user full access to
-- admin tables, a self-registered visitor (using the public anon key, which
-- is unavoidably exposed in the browser bundle) could otherwise read/write
-- all bookings and settings. This app has exactly one legitimate admin, so
-- tie the policies to that specific account (marked by app_metadata.app_role =
-- 'admin', set with the service-role key; see migration 0014) instead of the whole
-- "authenticated" role.
--
-- Also go to Authentication > Sign In / Providers > Email in the dashboard
-- and turn off "Allow new users to sign up" — this migration is defense in
-- depth in case that setting is ever left on or reset.

create or replace function is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'app_role', '') = 'admin';
$$;

drop policy if exists "admin_full_access" on services;
drop policy if exists "admin_full_access" on availability_rules;
drop policy if exists "admin_full_access" on blocked_slots;
drop policy if exists "admin_full_access" on settings;
drop policy if exists "admin_full_access" on appointments;

create policy "admin_full_access" on services for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_full_access" on availability_rules for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_full_access" on blocked_slots for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_full_access" on settings for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_full_access" on appointments for all to authenticated using (is_admin()) with check (is_admin());
