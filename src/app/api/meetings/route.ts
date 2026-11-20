import { meetingSchema } from "@/lib/submissions/schema";
import { indiaToday } from "@/lib/date";
import { getProjectBySlug, getPropertyBySlug } from "@/lib/data/repository";
import { prepareStore } from "@/lib/data/store";
import { readJson, apiError, HttpError } from "@/lib/api/http";
import { submissionIdentity, saveSubmission } from "@/lib/submissions/save";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const parsed = meetingSchema.safeParse(await readJson(request, 16_384));
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[String(issue.path[0] ?? "form")] ??= issue.message;
      return Response.json({ error: "Please check these.", fields }, { status: 400 });
    }
    const meeting = parsed.data;
    if (meeting.date < indiaToday()) return Response.json({ error: "Please check these.", fields: { date: "Choose today or a later date." } }, { status: 400 });
    const identity = await submissionIdentity(request);
    await prepareStore();
    let subject: { kind: "property" | "project"; slug: string; label: string } | null = null;
    if (meeting.projectSlug) {
      const project = getProjectBySlug(meeting.projectSlug);
      if (!project) throw new HttpError(404, "This project is no longer available.");
      subject = { kind: "project", slug: project.slug, label: project.name };
    } else if (meeting.propertySlug) {
      const property = getPropertyBySlug(meeting.propertySlug);
      if (!property) throw new HttpError(404, "This property is no longer available.");
      subject = { kind: "property", slug: property.slug, label: property.title };
    }
    const record = await saveSubmission(request, identity, "viewing_requests", meeting, subject);
    return Response.json({ id: record.id, date: meeting.date, slot: meeting.slot, mode: meeting.mode, status: record.status, subject }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
