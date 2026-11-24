import { z } from "zod";
import { apiError, HttpError } from "@/lib/api/http";
import { requestBudget } from "@/lib/api/rate-limit";
import { getStore, prepareStore } from "@/lib/data/store";
import type { ProjectSummary } from "@/lib/data/project-summary";

export async function GET(request: Request) {
  try {
    if (request.url.length > 16384) throw new HttpError(414, "This request is too long.");
    await requestBudget(request, "read");
    const ids = [...new Set(z.array(z.string().min(1).max(120)).max(100).parse((new URL(request.url).searchParams.get("ids") ?? "").split(",").map(id => id.trim()).filter(Boolean)))];
    await prepareStore();
    const store = getStore();
    const items: ProjectSummary[] = ids.flatMap(id => {
      const project = store.projectById.get(id);
      return project ? [{ id, slug: project.slug, name: project.name, heroImage: project.heroImage, priceMin: project.priceMin, status: project.status, localityName: store.localityById.get(project.localityId)?.name ?? "Hyderabad", developerName: store.developerById.get(project.developerId)?.name ?? "" }] : [];
    });
    return Response.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
