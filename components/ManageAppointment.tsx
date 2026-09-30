"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import WeekPicker from "@/components/WeekPicker";
import { CHANGE_DEADLINE_HOURS, lastBookableDate, MAX_ADVANCE_DAYS } from "@/lib/booking";
import { formatDateLong, todayAthens } from "@/lib/time";

interface Details {
  id: string;
  serviceName: string;
  status: "confirmed" | "cancelled";
  date: string;
  start: string;
  end: string;
  canChange: boolean;
}

type View = "details" | "move" | "confirmCancel" | "cancelled" | "moved";

const PRIMARY = "w-full h-12 rounded-md bg-brand-purple text-white font-medium disabled:opacity-60";
const OUTLINE = "w-full h-12 rounded-md border border-brand-purple text-brand-purple font-medium disabled:opacity-60";

// The customer's private page for one appointment (/a/<id>): see it, move
// it to another free time, or cancel it — until CHANGE_DEADLINE_HOURS
// before it starts. Customers have no account; the link itself is the key.
export default function ManageAppointment({ id }: { id: string }) {
  const [details, setDetails] = useState<Details | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [view, setView] = useState<View>("details");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Moving: the days that have a free time, the chosen day, its times.
  const today = todayAthens();
  const [availableDates, setAvailableDates] = useState<Set<string> | null>(null);
  const [dayInfo, setDayInfo] = useState<Record<string, { open: boolean; count: number }> | null>(null);
  const [datesState, setDatesState] = useState<"loading" | "ready" | "failed">("loading");
  const [selectedDate, setSelectedDate] = useState(today);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const slotsRequest = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/appointments/${id}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) return setLoadState("notfound");
        const data = await res.json();
        if (!res.ok || !data.appointment) return setLoadState("error");
        setDetails(data.appointment);
        setView(data.appointment.status === "cancelled" ? "cancelled" : "details");
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function loadSlots(date: string, current: Details) {
    const request = ++slotsRequest.current;
    setLoadingSlots(true);
    setSlots(null);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${id}/slots?date=${date}`);
      const data = await res.json();
      if (request !== slotsRequest.current) return;
      if (!res.ok) {
        setError(data.error ?? "Σφάλμα φόρτωσης διαθέσιμων ωρών.");
        setSlots([]);
      } else {
        // Its own current time isn't a move.
        const list = (data.slots as string[]).filter((t) => !(date === current.date && t === current.start));
        setSlots(list);
        // The day's number on the strip follows what was really listed.
        setDayInfo((prev) =>
          prev && prev[date] && prev[date].open && prev[date].count !== list.length
            ? { ...prev, [date]: { ...prev[date], count: list.length } }
            : prev
        );
      }
    } catch {
      if (request === slotsRequest.current) {
        setError("Σφάλμα φόρτωσης διαθέσιμων ωρών.");
        setSlots([]);
      }
    } finally {
      if (request === slotsRequest.current) setLoadingSlots(false);
    }
  }

  async function startMove() {
    if (!details) return;
    setView("move");
    setError(null);
    setSelectedSlot(null);
    setSlots(null);
    setDatesState("loading");
    setAvailableDates(null);
    setDayInfo(null);
    setSelectedDate(details.date >= today ? details.date : today);

    let dates: string[] | null = null;
    let days: Record<string, { open: boolean; count: number }> | null = null;
    try {
      const res = await fetch(`/api/appointments/${id}/availability`);
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Σφάλμα φόρτωσης διαθέσιμων ημερών.");
      else {
        dates = data.dates as string[];
        days = (data.days as Record<string, { open: boolean; count: number }>) ?? null;
      }
    } catch {
      setError("Σφάλμα φόρτωσης διαθέσιμων ημερών.");
    }

    if (!dates) {
      setDatesState("failed");
      return;
    }
    const set = new Set(dates);
    setAvailableDates(set);
    setDayInfo(days);
    setDatesState("ready");
    // Start on the current day when it still has other times, otherwise on
    // the first day that has any.
    const start = set.has(details.date) ? details.date : (dates[0] ?? details.date);
    setSelectedDate(start);
    if (dates.length > 0) void loadSlots(start, details);
  }

  function chooseDate(date: string) {
    if (!details) return;
    setSelectedDate(date);
    setSelectedSlot(null);
    // A day with no free time left has nothing to fetch; the strip says so.
    if (dayInfo?.[date]?.count === 0) {
      slotsRequest.current++;
      setSlots([]);
      setLoadingSlots(false);
      setError(null);
      return;
    }
    void loadSlots(date, details);
  }

  async function submitMove() {
    if (!selectedSlot) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, startTime: selectedSlot }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Κάτι πήγε στραβά.");
        if (data.code === "SLOT_UNAVAILABLE") {
          setSlots((prev) => (prev ? prev.filter((t) => t !== selectedSlot) : prev));
          setSelectedSlot(null);
        }
        return;
      }
      setDetails(data.appointment);
      setView("moved");
    } catch {
      setError("Σφάλμα σύνδεσης. Δοκιμάστε ξανά.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Κάτι πήγε στραβά.");
        setView("details");
        return;
      }
      setView("cancelled");
    } catch {
      setError("Σφάλμα σύνδεσης. Δοκιμάστε ξανά.");
      setView("details");
    } finally {
      setBusy(false);
    }
  }

  const summary = details && (
    <div className="rounded-lg border border-neutral-200 px-4 py-3 mb-6 text-sm text-left">
      <div className="font-medium">{details.serviceName}</div>
      <div>{formatDateLong(details.date)}</div>
      <div>
        Ώρα: {details.start} – {details.end}
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 my-6 bg-white rounded-2xl shadow-lg shadow-black/20">
      <div className="flex justify-center mb-4">
        <Image src="/logo-720.webp" unoptimized alt="Zoubou" width={900} height={300} priority className="w-full max-w-[360px] h-auto" />
      </div>

      {loadState === "loading" && <p className="text-center text-neutral-500 text-sm py-8">Φόρτωση…</p>}

      {loadState === "error" && (
        <p className="text-center text-red-600 text-sm py-8">Σφάλμα φόρτωσης. Δοκιμάστε ξανά σε λίγο.</p>
      )}

      {loadState === "notfound" && (
        <section className="text-center py-4">
          <h1 className="text-lg font-semibold mb-2">Το ραντεβού δεν βρέθηκε</h1>
          <p className="text-sm text-neutral-500 mb-6">Ο σύνδεσμος δεν ισχύει ή το ραντεβού έχει ήδη ολοκληρωθεί.</p>
          <Link href="/" className={`${PRIMARY} flex items-center justify-center`}>
            Κλείσε νέο ραντεβού
          </Link>
        </section>
      )}

      {loadState === "ready" && details && (
        <>
          {(view === "details" || view === "confirmCancel") && (
            <section className="text-center">
              <h1 className="text-lg font-semibold mb-4">Το ραντεβού σας</h1>
              {summary}

              {view === "details" && details.canChange && (
                <div className="flex flex-col gap-3">
                  <button type="button" onClick={startMove} className={PRIMARY}>
                    Αλλαγή ώρας
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setView("confirmCancel");
                    }}
                    className="w-full h-12 rounded-md border border-red-200 text-red-600 font-medium"
                  >
                    Ακύρωση ραντεβού
                  </button>
                  <p className="text-xs text-neutral-400">
                    Αλλαγές και ακυρώσεις γίνονται μέχρι {CHANGE_DEADLINE_HOURS} ώρες πριν το ραντεβού.
                  </p>
                </div>
              )}

              {view === "details" && !details.canChange && (
                <p className="text-sm text-neutral-500">
                  Οι αλλαγές και οι ακυρώσεις γίνονται μέχρι {CHANGE_DEADLINE_HOURS} ώρες πριν το ραντεβού. Αν χρειάζεστε
                  κάτι, επικοινωνήστε μαζί μας.
                </p>
              )}

              {view === "confirmCancel" && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-medium">Να ακυρωθεί το ραντεβού;</p>
                  <button
                    type="button"
                    onClick={submitCancel}
                    disabled={busy}
                    className="w-full h-12 rounded-md bg-red-600 text-white font-medium disabled:opacity-60"
                  >
                    {busy ? "Ακύρωση…" : "Ναι, ακύρωση"}
                  </button>
                  <button type="button" onClick={() => setView("details")} disabled={busy} className={OUTLINE}>
                    Όχι, κράτησέ το
                  </button>
                </div>
              )}

              {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
            </section>
          )}

          {view === "move" && (
            <section>
              <button type="button" onClick={() => setView("details")} className="text-sm text-brand-purple mb-4">
                ← Πίσω
              </button>
              <h1 className="text-lg font-semibold mb-1 text-center">Αλλαγή ώρας</h1>
              <p className="text-sm text-neutral-500 text-center mb-4">
                Τώρα: {formatDateLong(details.date)}, {details.start}
              </p>

              <div className={`mb-4 transition-opacity ${datesState === "loading" ? "opacity-50 pointer-events-none" : ""}`}>
                <WeekPicker
                  value={selectedDate}
                  onChange={chooseDate}
                  minDate={today}
                  maxDate={lastBookableDate(today)}
                  availableDates={availableDates}
                  dayInfo={dayInfo}
                  hideLabel={datesState === "ready" && availableDates?.size === 0}
                />
              </div>

              {datesState === "ready" && availableDates?.size === 0 ? (
                <p className="text-neutral-500 text-sm text-center">
                  Δεν υπάρχουν διαθέσιμες ημέρες τις επόμενες {MAX_ADVANCE_DAYS / 7} εβδομάδες.
                </p>
              ) : (
                !dayInfo && <p className="text-sm font-medium mb-2">{formatDateLong(selectedDate)}</p>
              )}

              {loadingSlots && <p className="text-neutral-500 text-sm">Φόρτωση ωρών…</p>}
              {!loadingSlots && slots && slots.length === 0 && availableDates?.size !== 0 && (
                <p className="text-neutral-500 text-sm">Δεν υπάρχουν άλλες διαθέσιμες ώρες αυτή την ημέρα.</p>
              )}

              <div className="grid grid-cols-3 gap-2">
                {slots?.map((time) => (
                  <button
                    type="button"
                    key={time}
                    aria-pressed={selectedSlot === time}
                    onClick={() => setSelectedSlot(time)}
                    className={`h-12 rounded-md border text-base tabular-nums ${
                      selectedSlot === time
                        ? "border-brand-purple bg-brand-purple text-white font-medium"
                        : "border-neutral-200 hover:border-brand-purple"
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>

              {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

              <button type="button" onClick={submitMove} disabled={!selectedSlot || busy} className={`${PRIMARY} mt-4`}>
                {busy ? "Μετακίνηση…" : selectedSlot ? `Μετακίνηση στις ${selectedSlot}` : "Επιλέξτε ώρα"}
              </button>
            </section>
          )}

          {view === "moved" && (
            <section className="text-center">
              <div className="w-14 h-14 rounded-full bg-brand-pink-light text-brand-purple flex items-center justify-center mx-auto mb-4 text-2xl">
                ✓
              </div>
              <h1 className="text-lg font-semibold mb-4">Το ραντεβού μετακινήθηκε</h1>
              {summary}
              <a href={`/api/ics/${details.id}`} className={`${OUTLINE} flex items-center justify-center mb-3`}>
                Προσθήκη στο ημερολόγιο
              </a>
              <p className="text-xs text-neutral-400">Αν το είχατε ήδη στο ημερολόγιό σας, διαγράψτε το παλιό.</p>
            </section>
          )}

          {view === "cancelled" && (
            <section className="text-center">
              <h1 className="text-lg font-semibold mb-2">Το ραντεβού ακυρώθηκε</h1>
              <p className="text-sm text-neutral-500 mb-6">Η ώρα ελευθερώθηκε. Μπορείτε να κλείσετε νέο ραντεβού όποτε θέλετε.</p>
              <Link href="/" className={`${PRIMARY} flex items-center justify-center`}>
                Κλείσε νέο ραντεβού
              </Link>
            </section>
          )}
        </>
      )}
    </div>
  );
}
