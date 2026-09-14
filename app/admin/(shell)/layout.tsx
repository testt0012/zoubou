import AdminShell from "@/components/admin/AdminShell";

// Scoped to the (shell) route group so it wraps dashboard/reports/
// availability/services but not /admin/login — and, being an actual
// layout, persists across navigations between those tabs instead of
// remounting (required for the bottom nav's slide transition to only
// animate the page content, not the whole shell).
export default function AdminShellLayout({ children }: LayoutProps<"/admin">) {
  return <AdminShell>{children}</AdminShell>;
}
