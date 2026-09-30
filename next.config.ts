import type { NextConfig } from "next";

// What the app loads and talks to (measured, not guessed): itself, and the
// Supabase project over https + a websocket for the admin's live updates.
// No third-party scripts, fonts, frames or analytics. Next.js itself puts two
// small inline scripts (and React a few inline style attributes) in every
// page, hence 'unsafe-inline' — the stricter nonce-based form would make
// every page render per request instead of being served ready-made.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseOrigins = supabaseUrl
  ? [new URL(supabaseUrl).origin, new URL(supabaseUrl).origin.replace(/^https:/, "wss:")]
  : [];

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src ${["'self'", ...supabaseOrigins].join(" ")}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const isProduction = process.env.NODE_ENV === "production";

const securityHeaders = [
  // Dev needs eval for hot reload, so the policy is only sent in production.
  ...(isProduction ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy }] : []),
  // No embedding in another site's frame (clickjacking); the CSP frame-ancestors
  // above says the same for current browsers.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here uses the camera, microphone, location, payments or USB.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The admin area, each customer's private appointment page and the API
      // stay out of search results. (robots.txt deliberately doesn't list
      // /admin: that would advertise the hidden entry point.)
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/a/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          // The secret appointment id is in this URL: never send it on as a referrer.
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/api/appointments/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

export default nextConfig;
