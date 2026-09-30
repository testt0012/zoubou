"use client";

// The last resort when even the root layout fails: it has to bring its own
// <html> and <body>, so it uses plain styles.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="el">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#f5f5f5" }}>
        <main style={{ maxWidth: 420, margin: "15vh auto", padding: 24, background: "#fff", borderRadius: 16, textAlign: "center" }}>
          <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>Κάτι πήγε στραβά</h1>
          <p style={{ fontSize: 14, color: "#737373", margin: "0 0 24px" }}>
            Παρουσιάστηκε ένα απρόσμενο πρόβλημα. Δοκιμάστε ξανά σε λίγο.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ width: "100%", height: 48, border: 0, borderRadius: 6, background: "#6d28d9", color: "#fff", fontSize: 16, fontWeight: 500 }}
          >
            Δοκιμάστε ξανά
          </button>
        </main>
      </body>
    </html>
  );
}
