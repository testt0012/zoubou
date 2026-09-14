"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BottomNav from "@/components/admin/BottomNav";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pt-6 pb-28">
        <div className="bg-white rounded-2xl shadow-lg shadow-black/20 px-4 py-6 sm:px-6">
          <div className="flex items-center justify-between mb-6">
            <Image
              src="/logo.png"
              alt="Zoubou"
              width={900}
              height={300}
              className="h-9 w-auto"
            />
            <button
              onClick={handleLogout}
              className="text-sm text-neutral-400 hover:text-neutral-700 whitespace-nowrap"
            >
              Έξοδος
            </button>
          </div>
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
