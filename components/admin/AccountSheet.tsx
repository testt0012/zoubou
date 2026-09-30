"use client";

import { useEffect, useState } from "react";
import BottomSheet from "@/components/admin/BottomSheet";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 10;
const FIELD_CLASS = "w-full h-12 border border-neutral-300 rounded-lg px-3 bg-white text-base text-neutral-900";

// "Λογαριασμός": who is signed in, and changing the password without going
// to the Supabase dashboard. The current password is checked first (so a
// phone left unlocked can't be used to take the account over), and on
// success every other signed-in device is signed out.
export default function AccountSheet({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!cancelled) setEmail(data.user?.email ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);

    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(`Ο νέος κωδικός πρέπει να έχει τουλάχιστον ${MIN_PASSWORD_LENGTH} χαρακτήρες.`);
      return;
    }
    if (next !== confirm) {
      setError("Οι δύο νέοι κωδικοί δεν ταιριάζουν.");
      return;
    }
    if (next === current) {
      setError("Ο νέος κωδικός πρέπει να διαφέρει από τον τρέχοντα.");
      return;
    }
    if (!email) {
      setError("Δεν βρέθηκε ο λογαριασμός. Συνδεθείτε ξανά.");
      return;
    }

    setBusy(true);
    const supabase = createClient();

    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: current });
    if (verifyError) {
      setError("Ο τρέχων κωδικός δεν είναι σωστός.");
      setBusy(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: next });
    if (updateError) {
      setError(
        /different from the old/i.test(updateError.message)
          ? "Ο νέος κωδικός πρέπει να διαφέρει από τον τρέχοντα."
          : "Ο νέος κωδικός δεν έγινε δεκτός. Δοκιμάστε έναν πιο μακρύ ή πιο δύσκολο κωδικό."
      );
      setBusy(false);
      return;
    }

    // Best-effort: a changed password should end sessions on other devices.
    await supabase.auth.signOut({ scope: "others" }).catch(() => {});

    setCurrent("");
    setNext("");
    setConfirm("");
    setDone(true);
    setBusy(false);
  }

  const type = show ? "text" : "password";

  return (
    <BottomSheet title="Λογαριασμός" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3 pt-1 pb-2">
        {email && <p className="text-sm text-neutral-500 break-all">Συνδεδεμένος ως {email}</p>}

        <h3 className="font-semibold">Αλλαγή κωδικού</h3>

        <label className="flex flex-col gap-1 text-sm text-neutral-500">
          Τρέχων κωδικός
          <input
            type={type}
            required
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-neutral-500">
          Νέος κωδικός (τουλάχιστον {MIN_PASSWORD_LENGTH} χαρακτήρες)
          <input
            type={type}
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-neutral-500">
          Επανάληψη νέου κωδικού
          <input
            type={type}
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={FIELD_CLASS}
          />
        </label>

        <label className="flex items-center gap-3 h-12 text-sm">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="w-5 h-5" />
          Εμφάνιση κωδικών
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {done && (
          <p className="text-sm text-green-700">
            Ο κωδικός άλλαξε. Οι άλλες συσκευές αποσυνδέθηκαν και θα χρειαστούν τον νέο κωδικό.
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !current || !next || !confirm}
          className="h-12 rounded-lg bg-brand-purple text-white font-medium disabled:opacity-60"
        >
          {busy ? "Αλλαγή…" : "Αλλαγή κωδικού"}
        </button>
      </form>
    </BottomSheet>
  );
}
