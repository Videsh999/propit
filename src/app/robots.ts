import { SITE_ORIGIN } from "@/lib/site-url";
import type { MetadataRoute } from "next";
import { isProductionDeployment } from "@/lib/deployment";

const BASE = SITE_ORIGIN;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: isProductionDeployment() ? [{ userAgent: "*", allow: "/", disallow: ["/api/", "/profile", "/compare", "/login", "/signup", "/auth/"] }] : [{ userAgent: "*", disallow: "/" }],
    ...(isProductionDeployment() ? { sitemap: `${BASE}/sitemap.xml` } : {}),
  };
}
