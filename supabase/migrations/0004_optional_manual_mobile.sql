-- Manually-entered appointments (walk-ins / phone calls the admin adds
-- directly) may not always have a mobile number on hand. The public
-- booking flow still requires one at the application layer
-- (app/api/book/route.ts) — this only relaxes the database constraint.
--
-- No need to touch appointments_mobile_check: a CHECK constraint only
-- rejects rows where it evaluates to FALSE, and `NULL ~ '...'` evaluates
-- to NULL (not FALSE), so the existing format check already permits NULL
-- once NOT NULL is dropped.
alter table appointments alter column mobile drop not null;
