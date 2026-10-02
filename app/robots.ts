import type { MetadataRoute } from "next";

// Search engines get the booking page only. (/admin isn't listed on purpose:
// naming it here would advertise the entry point — its pages say noindex
// themselves.)
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/a/"] } };
}
