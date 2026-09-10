import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Server-side Supabase client bound to the current request's cookies.
// Used in Server Components / Server Actions for the admin area — requests
// run as the "authenticated" role (RLS: admin_full_access policies).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no writable cookies —
            // proxy.ts refreshes the session on every request instead.
          }
        },
      },
    }
  );
}

// Defense in depth for Server Actions: proxy.ts already blocks
// unauthenticated access to /admin/*, but actions are also reachable
// directly, so verify the session here too before touching the database.
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  return { supabase, user };
}
