import { NextResponse, type NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/firebase/server";

// Protects the admin area. Clients never hit anything under /admin — this
// proxy is the single gate: no valid session -> bounce to /admin/login, and
// an already-logged-in admin visiting /admin/login goes straight through
// to the dashboard.
export async function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/admin/login";

  let authenticated = false;
  if (sessionCookie) {
    try {
      await adminAuth.verifySessionCookie(sessionCookie, false);
      authenticated = true;
    } catch {
      authenticated = false;
    }
  }

  if (!authenticated && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  if (authenticated && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
