"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/admin/dashboard", label: "Ραντεβού" },
  { href: "/admin/availability", label: "Διαθεσιμότητα" },
  { href: "/admin/services", label: "Υπηρεσίες" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <nav className="flex gap-4 text-sm overflow-x-auto">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap pb-1 border-b-2 ${
                  pathname === item.href
                    ? "border-brand-purple text-brand-purple font-medium"
                    : "border-transparent text-neutral-600"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <button
            onClick={handleLogout}
            className="text-sm text-neutral-500 whitespace-nowrap"
          >
            Αποσύνδεση
          </button>
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-lg shadow-black/20 px-4 py-6 sm:px-6">
          {children}
        </div>
      </main>
    </div>
  );
}
