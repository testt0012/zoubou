// The customer-facing screens in the dark theme (the admin stays light). The
// colours themselves are in app/globals.css under .customer-dark; the fixed
// layer here covers the photo background behind the page.
export default function CustomerShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="customer-dark flex-1 flex flex-col justify-center">
      <div aria-hidden="true" className="customer-dark-backdrop fixed inset-0 -z-10" />
      {children}
    </main>
  );
}
