// A small in-memory stand-in for the Supabase client: enough of the query
// builder (select / filters / order / limit / range / maybeSingle / upsert)
// for the booking and stats code to run against real-shaped rows.
type Row = Record<string, unknown>;

export interface FakeDbOptions {
  // Makes every read of a table fail with this error code.
  errors?: Record<string, string>;
}

export function makeDb(tables: Record<string, Row[]>, options: FakeDbOptions = {}) {
  const saved: Row[] = [];

  return {
    saved,
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      let single = false;
      let limit: number | null = null;
      let orderKey: string | null = null;
      let ascending = true;
      let range: [number, number] | null = null;

      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (key: string, value: unknown) => {
          rows = rows.filter((r) => r[key] === value);
          return builder;
        },
        gte: (key: string, value: string) => {
          rows = rows.filter((r) => (r[key] as string) >= value);
          return builder;
        },
        lte: (key: string, value: string) => {
          rows = rows.filter((r) => (r[key] as string) <= value);
          return builder;
        },
        order: (key: string, opts?: { ascending?: boolean }) => {
          orderKey = key;
          ascending = opts?.ascending ?? true;
          return builder;
        },
        limit: (n: number) => {
          limit = n;
          return builder;
        },
        range: (from: number, to: number) => {
          range = [from, to];
          return builder;
        },
        maybeSingle: () => {
          single = true;
          return builder;
        },
        upsert: (payload: Row[]) => {
          saved.push(...payload);
          return Promise.resolve({ error: null });
        },
        then: (resolve: (value: unknown) => void) => {
          const code = options.errors?.[table];
          if (code) return resolve({ data: null, error: { code, message: "boom" } });
          if (orderKey && rows.length && orderKey in rows[0]) {
            rows.sort((a, b) => (ascending ? 1 : -1) * String(a[orderKey!]).localeCompare(String(b[orderKey!])));
          }
          if (limit !== null) rows = rows.slice(0, limit);
          if (range) rows = rows.slice(range[0], range[1] + 1);
          resolve({ data: single ? (rows[0] ?? null) : rows, error: null });
        },
      };
      return builder;
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// Shorthand fixtures.
export const service = (over: Row = {}) => ({ id: "svc", duration_minutes: 40, active: true, ...over });
export const rule = (weekday: number, start: string, end: string) => ({
  weekday,
  start_time: `${start}:00`,
  end_time: `${end}:00`,
});
export const appointment = (date: string, start: string, end: string, over: Row = {}) => ({
  id: `${date}-${start}`,
  date,
  start_time: `${start}:00`,
  end_time: `${end}:00`,
  status: "confirmed",
  ...over,
});
export const blocked = (date: string, start = "00:00", end = "23:59") => ({
  date,
  start_time: `${start}:00`,
  end_time: `${end}:00`,
});
export const regular = (over: Row = {}) => ({
  id: "reg",
  start_date: "2026-10-06",
  interval_weeks: 1,
  start_time: "13:00:00",
  zone_end_time: null,
  skipped_dates: [],
  services: { duration_minutes: 40 },
  ...over,
});
