import { z } from "zod";
import type { CommunityUpdate } from "@/types";

export const communityUpdateSchema = z.object({
  id: z.string().min(1).max(120), category: z.enum(["auction", "sale", "news", "milestone"]),
  title: z.string().trim().min(5).max(160), summary: z.string().trim().min(10).max(1200),
  publishedAt: z.string().datetime(), sourceName: z.string().trim().min(2).max(100),
  sourceUrl: z.string().url().max(2000).refine(value => new URL(value).protocol === "https:", "A source must use HTTPS."),
  verified: z.boolean().default(false), amount: z.number().finite().positive().max(1e13).optional(),
  configuration: z.string().max(40).optional(), areaSqft: z.number().finite().positive().max(1e7).optional(),
});

export function publishedCommunityUpdates(updates: CommunityUpdate[] = [], now = Date.now()) {
  return updates.filter(update => update.verified && Number.isFinite(Date.parse(update.publishedAt)) && Date.parse(update.publishedAt) <= now)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 12);
}
