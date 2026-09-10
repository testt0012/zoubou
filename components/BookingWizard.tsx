"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Calendar from "@/components/Calendar";
import { formatDateLong, todayAthens } from "@/lib/time";

const ADMIN_TAP_THRESHOLD = 5;
const ADMIN_TAP_RESET_MS = 1200;

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
}

type Step = "intro" | "service" | "slot" | "form" | "confirmed";

interface ConfirmedAppointment {
  date: string;
  start_time: string;
  end_time: string;
  serviceName: string;
  firstName: string;
  lastName: string;
}

export default function BookingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("intro");
  const [services, setServices] = useState<Service[] | null>(null);
  const [servicesError, setServicesError] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  const logoTapCount = useRef(0);
  const logoTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hidden admin entry point: tap the logo a few times in a row to reach the
  // login page without a visible "admin" link anywhere in the public UI.
  function handleLogoTap() {
    logoTapCount.current += 1;
    if (logoTapTimer.current) clearTimeout(logoTapTimer.current);

    if (logoTapCount.current >= ADMIN_TAP_THRESHOLD) {
      logoTapCount.current = 0;
      router.push("/admin/login");
      return;
    }

    logoTapTimer.current = setTimeout(() => {
      logoTapCount.current = 0;
    }, ADMIN_TAP_RESET_MS);
  }

  const today = todayAthens();
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mobile, setMobile] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedAppointment | null>(null);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (step !== "slot" || !selectedService) return;
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
        else setSlots(data.slots ?? []);
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
  }, [step, selectedService, selectedDate]);

  function startBooking() {
    if (selectedService) setStep("slot");
    else setStep("service");
  }

  function chooseService(s: Service) {
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
    setStep("intro");
    // Keep the pre-selection when there's only one service — otherwise the
    // intro CTA would need a redundant "pick a service" step again.
    setSelectedService(services && services.length === 1 ? services[0] : null);
    setSelectedSlot(null);
    setSlots(null);
    setFirstName("");
    setLastName("");
    setMobile("");
    setWebsite("");
    setConfirmed(null);
    setSubmitError(null);
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 my-6 bg-white rounded-2xl shadow-lg shadow-black/20">
      {step !== "intro" && (
        <div className="flex justify-center mb-4">
          <Image
            src="/logo.png"
            alt="Zoubou"
            width={900}
            height={300}
            priority
            className="w-full max-w-[360px] h-auto"
          />
        </div>
      )}
      {step !== "intro" && step !== "confirmed" && (
        <ol className="flex items-center justify-center gap-2 mb-6 text-sm">
          {(["service", "slot", "form"] as Step[]).map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                  step === s
                    ? "bg-brand-purple text-white"
                    : "bg-neutral-200 text-neutral-500"
                }`}
              >
                {i + 1}
              </span>
              {i < 2 && <span className="w-4 h-px bg-neutral-300" />}
            </li>
          ))}
        </ol>
      )}

      {step === "intro" && (
        <section className="text-center py-4">
          <Image
            src="/logo.png"
            alt="Zoubou"
            width={900}
            height={300}
            priority
            onClick={handleLogoTap}
            className="w-full max-w-[360px] h-auto mx-auto mb-8 select-none"
          />
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

          <div className="mb-4">
            <Calendar selectedDate={selectedDate} minDate={today} onSelect={setSelectedDate} />
          </div>

          <p className="text-sm font-medium mb-2">{formatDateLong(selectedDate)}</p>

          {loadingSlots && <p className="text-neutral-500 text-sm">Φόρτωση ωρών…</p>}
          {slotsError && <p className="text-red-600 text-sm">{slotsError}</p>}
          {!loadingSlots && !slotsError && slots && slots.length === 0 && (
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
