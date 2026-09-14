import AdminShell from "@/components/admin/AdminShell";
import AdminDataProvider from "@/components/admin/AdminDataProvider";

// Scoped to the (shell) route group so it wraps dashboard/reports/
// availability/services but not /admin/login — and, being an actual
// layout, persists across navigations between those tabs instead of
// remounting (required both for the bottom nav's slide transition to only
// animate the page content, and for AdminDataProvider to load data once
// and keep it in memory across tab switches instead of refetching).
export default function AdminShellLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AdminDataProvider>
      <AdminShell>{children}</AdminShell>
    </AdminDataProvider>
  );
}
