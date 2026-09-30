import CustomerShell from "@/components/CustomerShell";
import BookingWizard from "@/components/BookingWizard";
import { createAdminClient } from "@/lib/supabase/admin";

// The page is built ready-made and refreshed at most once a minute (and
// straight away when the admin changes a service — see lib/actions/services.ts),
// so the list of services is already in it: the booking screen doesn't have to
// fetch it first, which used to be the first link of a chain of three requests.
export const revalidate = 60;

async function loadServices() {
  try {
    const { data, error } = await createAdminClient()
      .from("services")
      .select("id, name, duration_minutes")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    return error ? null : data;
  } catch {
    // If the database can't be reached while the page is built, the booking
    // screen falls back to fetching the list itself.
    return null;
  }
}

export default async function Home() {
  const services = await loadServices();

  return (
    <CustomerShell>
      <BookingWizard initialServices={services} />
    </CustomerShell>
  );
}
