-- No new accounts, by any route. This app has exactly one account — the
-- admin — so nothing should ever be able to create another one: not a
-- public sign-up, not a magic-link/OTP "sign in" that creates the user, not
-- an invite, not even the service-role admin API.
--
-- The dashboard switch (Authentication -> Sign In / Providers -> "Allow new
-- users to sign up" = off) is the first lock. This trigger is a second one,
-- inside the database, so it still holds if that setting is ever reset.
--
-- It refuses every insert into auth.users. (An earlier draft let through a
-- row carrying app_metadata.app_role = 'admin', but the auth server adds
-- that only in a second step after the insert, so the check never passed and
-- even the admin API was refused — which is what we want here anyway.)
-- Signing in, changing a password and updating the existing account are
-- untouched: they are updates, not inserts.
--
-- To add another admin some day: drop the trigger, create the user with the
-- service-role key and app_metadata { "app_role": "admin" }, then run this
-- migration again.
create or replace function public.block_new_accounts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Creating new accounts is not allowed';
end;
$$;

drop trigger if exists block_new_accounts on auth.users;
create trigger block_new_accounts
  before insert on auth.users
  for each row execute function public.block_new_accounts();

-- The one table that still let "any signed-in user" in (migration 0008 missed
-- it when the admin-only policies of 0002 were written): the admin's push
-- subscriptions. Someone holding a stray account could have added their own
-- device and received the new-booking alerts.
drop policy if exists "admin_full_access" on admin_push_subscriptions;
create policy "admin_full_access" on admin_push_subscriptions
  for all to authenticated using (is_admin()) with check (is_admin());
