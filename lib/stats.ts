import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/time";
import { bookedMinutesForDate, workingMinutesForDate } from "@/lib/occupancy";
import { recurringMinutesForDate } from "@/lib/recurring";
import { dayTotals } from "@/lib/reports";
import { loadRegulars } from "@/lib/slots";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

const PAGE_SIZE = 1000; // PostgREST returns at most this many rows per request
// How many days one run will fill in — a first run or a long outage is
// worked off over several nights rather than in one long request.
const MAX_DAYS_PER_RUN = 120;

interface Span {
  date: string;
  start_time: string;
  end_time: string;
}

async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { code?: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await build(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

// Freezes every finished day (up to yesterday) that has no row yet in
// daily_stats: from the day after the last saved one, or, the first time,
// from the earliest appointment on record. Days are computed the same way
// the live screens compute them (opening hours minus blocked time, against
// booked appointments plus regular customers' visits), as they stand now.
export async function snapshotMissingDays(
  supabase: Db,
  today: string
): Promise<{ saved: number; from: string | null; to: string | null }> {
  const end = addDays(today, -1);

  const { data: last, error: lastError } = await supabase
    .from("daily_stats")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) throw lastError;

  let start: string;
  if (last) {
    start = addDays(last.date as string, 1);
  } else {
    const { data: first } = await supabase
      .from("appointments")
      .select("date")
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!first) return { saved: 0, from: null, to: null };
    start = first.date as string;
  }

  if (start > end) return { saved: 0, from: null, to: null };
  const stop = addDays(start, MAX_DAYS_PER_RUN - 1) < end ? addDays(start, MAX_DAYS_PER_RUN - 1) : end;

  const [{ data: rules, error: rulesError }, blocked, booked, visits] = await Promise.all([
    supabase.from("availability_rules").select("weekday, start_time, end_time"),
    fetchAll<Span>((from, to) =>
      supabase
        .from("blocked_slots")
        .select("date, start_time, end_time")
        .gte("date", start)
        .lte("date", stop)
        .order("id", { ascending: true })
        .range(from, to)
    ),
    fetchAll<Span>((from, to) =>
      supabase
        .from("appointments")
        .select("date, start_time, end_time")
        .eq("status", "confirmed")
        .gte("date", start)
        .lte("date", stop)
        .order("id", { ascending: true })
        .range(from, to)
    ),
    loadRegulars(supabase, stop),
  ]);

  // Frozen days are never recomputed, so a read that failed must stop the
  // run rather than be saved as "closed, nothing booked".
  if (rulesError) throw rulesError;
  if (visits === null) throw new Error("recurring customers could not be read");
  const weekly = rules ?? [];
  const rows = [];
  for (let date = start; date <= stop; date = addDays(date, 1)) {
    const totals = dayTotals(
      workingMinutesForDate(weekly, blocked, date),
      bookedMinutesForDate(booked, date) + recurringMinutesForDate(visits, weekly, blocked, booked, date)
    );
    rows.push({ date, working_minutes: totals.working, booked_minutes: totals.booked });
  }

  const { error } = await supabase.from("daily_stats").upsert(rows, { onConflict: "date" });
  if (error) throw error;

  return { saved: rows.length, from: start, to: stop };
}
