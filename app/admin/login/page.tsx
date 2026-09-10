"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      const idToken = await credential.user.getIdToken();

      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) throw new Error("session");

      router.replace("/admin/dashboard");
      router.refresh();
    } catch {
      setError("Λάθος στοιχεία σύνδεσης.");
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg shadow-black/20 px-6 py-8">
        <div className="flex justify-center mb-6">
          <Image
            src="/logo.png"
            alt="Zoubou"
            width={900}
            height={300}
            className="w-full max-w-[280px] h-auto"
          />
        </div>
        <h1 className="text-lg font-semibold text-center mb-6">Σύνδεση διαχειριστή</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-neutral-300 rounded-md px-3 py-2 focus:outline-none focus:border-brand-purple"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Κωδικός
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-neutral-300 rounded-md px-3 py-2 focus:outline-none focus:border-brand-purple"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full bg-brand-purple text-white rounded-md py-3 font-medium disabled:opacity-60"
          >
            {loading ? "Σύνδεση…" : "Σύνδεση"}
          </button>
        </form>
      </div>
    </div>
  );
}
