-- One-off exceptions for a regular customer: dates they would normally be
-- due on but aren't coming. On those dates nothing is held for them — the
-- fixed time / the opening in their zone goes back to being bookable — and
-- every other week carries on as usual (see occursOn in lib/recurring.ts).
alter table recurring_customers
  add column skipped_dates date[] not null default '{}';
