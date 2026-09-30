"use client";

// Shown instead of Next.js's default error screen when a page crashes
// unexpectedly: plain Greek, and a way to try again.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex-1 flex flex-col justify-center">
      <div className="w-full max-w-md mx-auto px-4 py-8 my-6 bg-white rounded-2xl shadow-lg shadow-black/20 text-center">
        <h1 className="text-lg font-semibold mb-2">Κάτι πήγε στραβά</h1>
        <p className="text-sm text-neutral-500 mb-6">
          Παρουσιάστηκε ένα απρόσμενο πρόβλημα. Δοκιμάστε ξανά σε λίγο.
        </p>
        <button
          type="button"
          onClick={reset}
          className="w-full h-12 rounded-md bg-brand-purple text-white font-medium"
        >
          Δοκιμάστε ξανά
        </button>
      </div>
    </main>
  );
}
