import type { User } from "@supabase/supabase-js";

// Who counts as the admin is a flag on the account itself — app_metadata
// { app_role: "admin" } — not an email address written into the code or the
// database policies. app_metadata can only be changed with the service-role
// key (never by a user from the browser), so signing up can't grant it. The
// database side of the same check is is_admin() (migration 0014), which
// reads the same flag from the session token.
export function isAdminUser(user: Pick<User, "app_metadata"> | null | undefined): boolean {
  return user?.app_metadata?.app_role === "admin";
}
