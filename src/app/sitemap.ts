import type { MetadataRoute } from "next";
import { allLocalities, allProjects } from "@/lib/data/repository";
import { getStore } from "@/lib/data/store";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const store = getStore();

  const statics: MetadataRoute.Sitemap = (
    [
      { url: BASE, changeFrequency: "daily", priority: 1 },
      { url: `${BASE}/search`, changeFrequency: "hourly", priority: 0.9 },
      { url: `${BASE}/projects`, changeFrequency: "daily", priority: 0.8 },
      { url: `${BASE}/localities`, changeFrequency: "weekly", priority: 0.8 },
      { url: `${BASE}/sell`, changeFrequency: "monthly", priority: 0.6 },
      { url: `${BASE}/about`, changeFrequency: "monthly", priority: 0.4 },
    ] as const
  ).map((e) => ({ ...e, lastModified: now }));

  return [
    ...statics,
    ...allLocalities().map((l) => ({
      url: `${BASE}/locality/${l.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...allProjects().map((p) => ({
      url: `${BASE}/project/${p.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...store.properties.map((p) => ({
      url: `${BASE}/property/${p.slug}`,
      lastModified: new Date(p.createdAt),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
