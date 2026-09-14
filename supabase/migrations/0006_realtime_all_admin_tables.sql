-- Extends the live-update subscription (see migration 0005) to every table
-- the admin cache reads, not just appointments — the client-side admin
-- data cache (components/admin/AdminDataProvider.tsx) now subscribes to
-- all of these so any change (from this admin, another tab, or the public
-- booking flow) refreshes the relevant slice automatically.
alter publication supabase_realtime add table availability_rules;
alter publication supabase_realtime add table blocked_slots;
alter publication supabase_realtime add table services;
alter publication supabase_realtime add table settings;
