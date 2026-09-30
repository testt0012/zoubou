import type { Metadata } from "next";
import CustomerShell from "@/components/CustomerShell";
import ManageAppointment from "@/components/ManageAppointment";

// A private page per appointment — reachable only with its link — so it
// stays out of search results.
export const metadata: Metadata = {
  title: "Το ραντεβού μου | Zoubou",
  robots: { index: false, follow: false },
};

export default async function AppointmentPage(props: PageProps<"/a/[id]">) {
  const { id } = await props.params;

  return (
    <CustomerShell>
      <ManageAppointment id={id} />
    </CustomerShell>
  );
}
