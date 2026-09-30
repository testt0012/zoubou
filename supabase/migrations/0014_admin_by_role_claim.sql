-- The admin is no longer identified by an email address hard-coded into the
-- database policies (and so into the public repository). Instead the admin
-- account carries app_metadata { "app_role": "admin" } — set with the
-- service-role key, which a user can't do for themselves from the browser —
-- and is_admin() reads that flag from the session token.
--
-- Every policy already calls is_admin(), so redefining it is all it takes.
--
-- Before running this, the flag must be on the admin account (it is, for the
-- current one). A session that was opened earlier doesn't have the flag in
-- its token until the token is refreshed (within about an hour) or the admin
-- signs out and in again.
create or replace function is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'app_role', '') = 'admin';
$$;
