// The customer-facing screens in the dark theme (and the admin too). The
// colours are in app/globals.css under .app-dark; the photo
// background behind the page is left as it is.
export default function CustomerShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-dark flex-1 flex flex-col justify-center">
      {children}
    </main>
  );
}
