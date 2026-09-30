"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import WeekPicker from "@/components/WeekPicker";
import { formatDateLong, todayAthens } from "@/lib/time";
import { lastBookableDate, MAX_ADVANCE_DAYS } from "@/lib/booking";
import { isPushSupported, subscribeToPush } from "@/lib/push/client";

const ADMIN_HOLD_MS = 3000;
// How long a day list fetched in the background stays good before the
// booking screen asks again.
const AVAILABILITY_FRESH_MS = 60_000;

function isStale(since: number): boolean {
  return Date.now() - since > AVAILABILITY_FRESH_MS;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
}

type Step = "intro" | "service" | "slot" | "form" | "confirmed";

interface ConfirmedAppointment {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  serviceName: string;
  firstName: string;
  lastName: string;
}

export default function BookingWizard({ initialServices = null }: { initialServices?: Service[] | null }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("intro");
  const [services, setServices] = useState<Service[] | null>(initialServices);
  const [servicesError, setServicesError] = useState(false);
  // With a single service there's no real choice to make — it is pre-selected
  // so the CTA can skip straight to picking a time.
  const [selectedService, setSelectedService] = useState<Service | null>(
    initialServices && initialServices.length === 1 ? initialServices[0] : null
  );

  const [logoPressing, setLogoPressing] = useState(false);
  const [enteringAdmin, setEnteringAdmin] = useState(false);
  const logoHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hidden admin entry point: press and hold the logo for 3s to reach the
  // login page without a visible "admin" link anywhere in the public UI.
  function startLogoHold() {
    if (enteringAdmin) return;
    setLogoPressing(true);
    logoHoldTimer.current = setTimeout(() => {
      setEnteringAdmin(true);
      setTimeout(() => router.push("/admin/login"), 300);
    }, ADMIN_HOLD_MS);
  }

  function cancelLogoHold() {
    setLogoPressing(false);
    if (logoHoldTimer.current) {
      clearTimeout(logoHoldTimer.current);
      logoHoldTimer.current = null;
    }
  }

  const today = todayAthens();
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // Days the selected service can still be booked on (see /api/availability),
  // so the calendar can grey out the rest. "failed" leaves every day within
  // the booking window pickable rather than blocking the flow.
  const [availableDates, setAvailableDates] = useState<Set<string> | null>(null);
  // For every day in the booking window: is the shop open, and how many free times.
  const [dayInfo, setDayInfo] = useState<Record<string, { open: boolean; count: number }> | null>(null);
  // How many free times the strip says the chosen day has (undefined until known).
  const selectedCount = dayInfo?.[selectedDate]?.open ? dayInfo[selectedDate].count : dayInfo?.[selectedDate] ? 0 : undefined;
  const [datesState, setDatesState] = useState<"loading" | "ready" | "failed">("loading");
  const availabilityFor = useRef<string | null>(null);
  const availabilityAt = useRef(0);
  // The first free day's times, handed over with the day list, so they can be
  // shown without a second request.
  const preloadedSlots = useRef<{ date: string; slots: string[] } | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mobile, setMobile] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedAppointment | null>(null);
  const [reminderState, setReminderState] = useState<
    "unsupported" | "idle" | "subscribing" | "subscribed"
  >("unsupported");

  // Push (unlike Notification) doesn't exist at all in a plain Safari tab
  // on iOS, so this only ever offers the button when it can actually work —
  // deferred a tick since it's a synchronous browser-capability check done
  // from an effect (see lib/push/client.ts for the unsupported case).
  useEffect(() => {
    if (!confirmed) return;
    Promise.resolve().then(() => {
      if (isPushSupported() && Notification.permission !== "denied") {
        setReminderState("idle");
      }
    });
  }, [confirmed]);

  async function handleEnableReminder() {
    if (!confirmed) return;
    setReminderState("subscribing");
    const subscription = await subscribeToPush();
    if (!subscription) {
      setReminderState("unsupported");
      return;
    }
    try {
      await fetch("/api/push/customer-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: confirmed.id, subscription }),
      });
    } catch {
      // Best-effort — a failed subscribe doesn't affect the booking itself.
    }
    setReminderState("subscribed");
  }

  useEffect(() => {
    // Already in the page (see app/page.tsx).
    if (initialServices) return;
    fetch("/api/services")
      .then((r) => r.json())
      .then((data) => {
        const list: Service[] = data.services ?? [];
        setServices(list);
        // With a single service there's no real choice to make — pre-select
        // it so the CTA can skip straight to picking a time.
        if (list.length === 1) {
          setSelectedService(list[0]);
        }
      })
      .catch(() => setServicesError(true));
  }, [initialServices]);

  // The day list is fetched as soon as the service is known — already while
  // the first screen is being read — not only after "Book" is tapped, so by
  // the time it is tapped the answer is usually waiting.
  useEffect(() => {
    if (!selectedService) return;
    const serviceId = selectedService.id;
    // Already loaded (or loading) for this service — e.g. coming back from
    // the details form.
    if (availabilityFor.current === serviceId) return;
    availabilityFor.current = serviceId;
    availabilityAt.current = Date.now();

    Promise.resolve().then(() => {
      if (availabilityFor.current !== serviceId) return;
      setDatesState("loading");
      setAvailableDates(null);
      setDayInfo(null);
    });

    fetch(`/api/availability?serviceId=${serviceId}`)
      .then((r) => r.json())
      .then((data) => {
        if (availabilityFor.current !== serviceId) return;
        if (data.error || !Array.isArray(data.dates)) throw new Error("availability");
        const dates = new Set<string>(data.dates);
        setAvailableDates(dates);
        setDayInfo(data.days ?? null);
        preloadedSlots.current = data.firstDay ?? null;
        setDatesState("ready");
        // Land on the first day that can actually be booked.
        setSelectedDate((current) => (dates.has(current) || dates.size === 0 ? current : data.dates[0]));
      })
      .catch(() => {
        if (availabilityFor.current !== serviceId) return;
        setDatesState("failed");
      });
  }, [step, selectedService]);

  useEffect(() => {
    if (step !== "slot" || !selectedService) return;
    // Wait for the calendar's day list first, so the flow doesn't fetch
    // times for a day it's about to move off (or one that has none).
    if (datesState === "loading") return;
    // A day the shop is closed or that has no free time left has nothing to
    // fetch: the strip already says so.
    if (selectedCount === 0) {
      Promise.resolve().then(() => {
        setSlots([]);
        setSlotsError(null);
        setLoadingSlots(false);
        setSelectedSlot(null);
      });
      return;
    }
    if (availableDates && !availableDates.has(selectedDate)) return;

    // The first free day's times came with the day list: nothing to fetch.
    const preloaded = preloadedSlots.current;
    if (preloaded && preloaded.date === selectedDate) {
      preloadedSlots.current = null;
      Promise.resolve().then(() => {
        setSlots(preloaded.slots);
        setSlotsError(null);
        setLoadingSlots(false);
        setSelectedSlot(null);
      });
      return;
    }
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoadingSlots(true);
      setSlotsError(null);
      setSelectedSlot(null);
    });

    fetch(`/api/slots?serviceId=${selectedService.id}&date=${selectedDate}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) setSlotsError(data.error);
        else {
          const list: string[] = data.slots ?? [];
          setSlots(list);
          // The day's number on the strip follows what was really listed.
          setDayInfo((prev) =>
            prev && prev[selectedDate] && prev[selectedDate].count !== list.length
              ? { ...prev, [selectedDate]: { ...prev[selectedDate], count: list.length } }
              : prev
          );
        }
      })
      .catch(() => {
        if (!cancelled) setSlotsError("Σφάλμα φόρτωσης διαθέσιμων ωρών.");
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [step, selectedService, selectedDate, datesState, availableDates, selectedCount]);

  // A day list fetched a while ago is asked for again; a recent one is used.
  function refreshAvailabilityIfStale() {
    if (isStale(availabilityAt.current)) {
      availabilityFor.current = null;
      preloadedSlots.current = null;
    }
  }

  function startBooking() {
    refreshAvailabilityIfStale();
    if (selectedService) setStep("slot");
    else setStep("service");
  }

  function chooseService(s: Service) {
    refreshAvailabilityIfStale();
    setSelectedService(s);
    setStep("slot");
  }

  function chooseSlot(time: string) {
    setSelectedSlot(time);
    setStep("form");
    setSubmitError(null);
  }

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedService || !selectedSlot) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedService.id,
          date: selectedDate,
          startTime: selectedSlot,
          firstName,
          lastName,
          mobile,
          website,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error ?? "Κάτι πήγε στραβά.");
        if (data.code === "SLOT_UNAVAILABLE") {
          setStep("slot");
          setSlots((prev) => (prev ? prev.filter((s) => s !== selectedSlot) : prev));
        }
        return;
      }

      setConfirmed({
        id: data.appointment.id,
        date: data.appointment.date,
        start_time: data.appointment.start_time,
        end_time: data.appointment.end_time,
        serviceName: data.appointment.services?.name ?? selectedService.name,
        firstName,
        lastName,
      });
      setStep("confirmed");
    } catch {
      setSubmitError("Σφάλμα σύνδεσης. Δοκιμάστε ξανά.");
    } finally {
      setSubmitting(false);
    }
  }

  function startOver() {
    // What was free has changed (this booking took a time): ask again.
    availabilityFor.current = null;
    preloadedSlots.current = null;
    setStep("intro");
    // Keep the pre-selection when there's only one service — otherwise the
    // intro CTA would need a redundant "pick a service" step again.
    setSelectedService(services && services.length === 1 ? services[0] : null);
    setSelectedDate(todayAthens());
    setSelectedSlot(null);
    setSlots(null);
    setFirstName("");
    setLastName("");
    setMobile("");
    setWebsite("");
    setConfirmed(null);
    setSubmitError(null);
    setReminderState("unsupported");
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 my-6 bg-white rounded-2xl shadow-lg shadow-black/20">
      {step !== "intro" && (
        <div className="flex justify-center mb-4">
          <Image
            src="/logo-720.webp" unoptimized
            alt="Zoubou"
            width={900}
            height={300}
            priority
            className="w-full max-w-[360px] h-auto"
          />
        </div>
      )}
      {step === "intro" && (
        <section
          className={`text-center py-4 transition-opacity duration-300 ${
            enteringAdmin ? "opacity-0" : "opacity-100"
          }`}
        >
          <div
            className="inline-block select-none [-webkit-touch-callout:none] mb-3"
            onPointerDown={startLogoHold}
            onPointerUp={cancelLogoHold}
            onPointerLeave={cancelLogoHold}
            onPointerCancel={cancelLogoHold}
            onContextMenu={(e) => e.preventDefault()}
          >
            <Image
              src="/logo-720.webp" unoptimized
              alt="Zoubou"
              width={900}
              height={300}
              priority
              draggable={false}
              className={`w-full max-w-[360px] h-auto transition-transform duration-150 ${
                logoPressing ? "scale-[0.97]" : "scale-100"
              }`}
            />
          </div>
          <div
            className={`h-1 w-28 mx-auto mb-5 rounded-full bg-neutral-200 overflow-hidden transition-opacity duration-150 ${
              logoPressing ? "opacity-100" : "opacity-0"
            }`}
          >
            <div
              className="h-full bg-brand-purple rounded-full"
              style={{
                width: logoPressing ? "100%" : "0%",
                transitionProperty: "width",
                transitionDuration: logoPressing ? `${ADMIN_HOLD_MS}ms` : "150ms",
                transitionTimingFunction: "linear",
              }}
            />
          </div>
          <button
            onClick={startBooking}
            disabled={!services}
            className="w-full bg-brand-purple text-white rounded-md py-4 font-medium text-base disabled:opacity-60"
          >
            Κλείσε το επόμενό σου κούρεμα
          </button>
          {servicesError && (
            <p className="text-red-600 text-sm mt-3">
              Σφάλμα φόρτωσης υπηρεσιών. Δοκιμάστε ξανά αργότερα.
            </p>
          )}
        </section>
      )}

      {step === "service" && (
        <section>
          <h1 className="text-lg font-semibold mb-4 text-center">Επιλέξτε υπηρεσία</h1>
          {servicesError && (
            <p className="text-red-600 text-sm text-center">
              Σφάλμα φόρτωσης υπηρεσιών. Δοκιμάστε ξανά αργότερα.
            </p>
          )}
          {!services && !servicesError && (
            <p className="text-neutral-500 text-sm text-center">Φόρτωση…</p>
          )}
          <div className="flex flex-col gap-3">
            {services?.map((s) => (
              <button
                key={s.id}
                onClick={() => chooseService(s)}
                className="w-full text-left border border-neutral-200 rounded-lg px-4 py-3 hover:border-brand-purple active:bg-neutral-50 transition-colors"
              >
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-neutral-500">{s.duration_minutes} λεπτά</div>
              </button>
            ))}
            {services && services.length === 0 && (
              <p className="text-neutral-500 text-sm text-center">
                Δεν υπάρχουν διαθέσιμες υπηρεσίες αυτή τη στιγμή.
              </p>
            )}
          </div>
        </section>
      )}

      {step === "slot" && selectedService && (
        <section>
          {services && services.length > 1 && (
            <button
              onClick={() => setStep("service")}
              className="text-sm text-brand-purple mb-4"
            >
              ← Αλλαγή υπηρεσίας
            </button>
          )}
          <h1 className="text-lg font-semibold mb-1 text-center">{selectedService.name}</h1>
          <p className="text-sm text-neutral-500 text-center mb-4">
            {selectedService.duration_minutes} λεπτά
          </p>

          <div className={`mb-4 transition-opacity ${datesState === "loading" ? "opacity-50 pointer-events-none" : ""}`}>
            <WeekPicker
              value={selectedDate}
              onChange={setSelectedDate}
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
            // Without the day strip's own count (older answer / still loading) fall back to the plain date.
            !dayInfo && <p className="text-sm font-medium mb-2">{formatDateLong(selectedDate)}</p>
          )}

          {loadingSlots && <p className="text-neutral-500 text-sm">Φόρτωση ωρών…</p>}
          {slotsError && <p className="text-red-600 text-sm">{slotsError}</p>}
          {!loadingSlots && !slotsError && slots && slots.length === 0 && availableDates?.size !== 0 && (
            <p className="text-neutral-500 text-sm">
              Δεν υπάρχουν διαθέσιμες ώρες αυτή την ημέρα. Δοκιμάστε άλλη ημερομηνία.
            </p>
          )}

          <div className="grid grid-cols-3 gap-2">
            {slots?.map((time) => (
              <button
                key={time}
                onClick={() => chooseSlot(time)}
                className="rounded-md border border-neutral-200 py-2 text-sm hover:border-brand-purple active:bg-neutral-50"
              >
                {time}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === "form" && selectedService && selectedSlot && (
        <section>
          <button onClick={() => setStep("slot")} className="text-sm text-brand-purple mb-4">
            ← Αλλαγή ώρας
          </button>
          <div className="rounded-lg bg-brand-pink-light px-4 py-3 mb-4 text-sm">
            <div className="font-medium">{selectedService.name}</div>
            <div>{formatDateLong(selectedDate)}</div>
            <div>Ώρα: {selectedSlot}</div>
          </div>

          <form onSubmit={submitBooking} className="flex flex-col gap-3">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium mb-1">
                Όνομα
              </label>
              <input
                id="firstName"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border border-neutral-300 rounded-md px-3 py-2 focus:outline-none focus:border-brand-purple"
                maxLength={60}
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium mb-1">
                Επώνυμο
              </label>
              <input
                id="lastName"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full border border-neutral-300 rounded-md px-3 py-2 focus:outline-none focus:border-brand-purple"
                maxLength={60}
              />
            </div>
            <div>
              <label htmlFor="mobile" className="block text-sm font-medium mb-1">
                Κινητό τηλέφωνο
              </label>
              <input
                id="mobile"
                required
                inputMode="numeric"
                placeholder="69XXXXXXXX"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full border border-neutral-300 rounded-md px-3 py-2 focus:outline-none focus:border-brand-purple"
                maxLength={10}
              />
            </div>

            {/* Honeypot field — visually hidden (not display:none) from real users, bots often fill every field */}
            <div
              className="absolute w-px h-px overflow-hidden whitespace-nowrap"
              style={{ clip: "rect(0 0 0 0)" }}
              aria-hidden="true"
            >
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            {submitError && <p className="text-red-600 text-sm">{submitError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full bg-brand-purple text-white rounded-md py-3 font-medium disabled:opacity-60"
            >
              {submitting ? "Επεξεργασία…" : "Επιβεβαίωση ραντεβού"}
            </button>
          </form>
        </section>
      )}

      {step === "confirmed" && confirmed && (
        <section className="text-center">
          <div className="w-14 h-14 rounded-full bg-brand-pink-light text-brand-purple flex items-center justify-center mx-auto mb-4 text-2xl">
            ✓
          </div>
          <h1 className="text-lg font-semibold mb-2">Το ραντεβού σας κλείστηκε!</h1>
          <div className="rounded-lg border border-neutral-200 px-4 py-3 mb-6 text-sm text-left">
            <div className="font-medium">{confirmed.serviceName}</div>
            <div>{formatDateLong(confirmed.date)}</div>
            <div>
              Ώρα: {confirmed.start_time} – {confirmed.end_time}
            </div>
            <div className="mt-2 text-neutral-500">
              {confirmed.firstName} {confirmed.lastName}
            </div>
          </div>
          <a
            href={`/api/ics/${confirmed.id}`}
            className="w-full block text-center border border-brand-purple text-brand-purple rounded-md py-3 font-medium mb-3"
          >
            Προσθήκη στο ημερολόγιο
          </a>
          <a
            href={`/a/${confirmed.id}`}
            className="w-full block text-center border border-neutral-300 text-neutral-700 rounded-md py-3 font-medium mb-3"
          >
            Αλλαγή ή ακύρωση ραντεβού
          </a>
          {(reminderState === "idle" || reminderState === "subscribing") && (
            <button
              onClick={handleEnableReminder}
              disabled={reminderState === "subscribing"}
              className="w-full border border-brand-purple text-brand-purple rounded-md py-3 font-medium mb-3 disabled:opacity-60"
            >
              {reminderState === "subscribing" ? "…" : "Ενεργοποίηση υπενθύμισης"}
            </button>
          )}
          {reminderState === "subscribed" && (
            <p className="text-sm text-neutral-500 mb-3">
              Θα λάβετε υπενθύμιση μία μέρα πριν το ραντεβού σας.
            </p>
          )}
          <button
            onClick={startOver}
            className="w-full bg-brand-purple text-white rounded-md py-3 font-medium"
          >
            Νέο ραντεβού
          </button>
        </section>
      )}
    </div>
  );
}
