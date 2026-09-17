import { SITE_ORIGIN } from "@/lib/site-url";
import type { MetadataRoute } from "next";

const BASE = SITE_ORIGIN;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/profile", "/compare"] }],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
