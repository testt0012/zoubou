// The customer-facing screens in the dark theme (the admin stays light). The
// colours are in app/globals.css under .customer-dark; the photo
// background behind the page is left as it is.
export default function CustomerShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="customer-dark flex-1 flex flex-col justify-center">
      {children}
    </main>
  );
}
