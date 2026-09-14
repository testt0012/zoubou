-- Lets the admin UI subscribe to live changes on appointments (e.g. a
-- client booking online while the admin has the dashboard open) so it can
-- refresh automatically instead of requiring a manual reload. Realtime
-- events still respect RLS, so the anon-key browser subscription only
-- receives rows the "admin_full_access" policy already lets it see.
alter publication supabase_realtime add table appointments;
