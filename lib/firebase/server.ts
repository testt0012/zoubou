import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/firebase/admin";

export const SESSION_COOKIE_NAME = "session";

// Defense in depth for Server Actions: proxy.ts already blocks
// unauthenticated access to /admin/*, but actions are also reachable
// directly, so verify the session here too before touching the database.
export async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!session) {
    redirect("/admin/login");
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(session, false);
    return { uid: decoded.uid };
  } catch {
    redirect("/admin/login");
  }
}
