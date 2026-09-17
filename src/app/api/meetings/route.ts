import { NextResponse } from "next/server";
import { z } from "zod";
import { getProjectBySlug, getPropertyBySlug } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

/**
 * Viewing requests.
 *
 * Stored in memory for now, which is the honest shape of this feature until
 * there is somewhere to send them. The endpoint validates properly and returns
 * a real reference, so the form is not a button that pretends — but nothing
 * here emails anyone, and the UI says so rather than implying a human is on
 * the other end.
 *
 * When a CRM or mailer is connected, this handler is the only thing that
 * changes: the contract it already returns is the one the UI consumes.
 */
const g = globalThis as unknown as { __propitMeetings?: MeetingRecord[] };
const store = (): MeetingRecord[] => (g.__propitMeetings ??= []);

export interface MeetingRecord extends z.infer<typeof meetingSchema> {
  id: string;
  createdAt: string;
  subject: { kind: "property" | "project"; slug: string; label: string } | null;
}

/** Indian mobile numbers, with or without the country code. */
const PHONE = /^(?:\+?91[-\s]?)?[6-9]\d{9}$/;

const meetingSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name.").max(80),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => PHONE.test(v), "That doesn't look like an Indian mobile number."),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  /** "site" is a visit in person; the others need no travel. */
  mode: z.enum(["site", "video", "call"]),
  /** ISO date, no time — the slot carries that. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  slot: z.enum(["morning", "afternoon", "evening"]),
  note: z.string().trim().max(500).optional(),
  propertySlug: z.string().max(120).optional(),
  projectSlug: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  let parsed: z.infer<typeof meetingSchema>;
  try {
    parsed = meetingSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      // Field-keyed so the form can put each message beside its own input.
      const fields: Record<string, string> = {};
      for (const issue of err.issues) {
        const key = String(issue.path[0] ?? "form");
        fields[key] ??= issue.message;
      }
      return NextResponse.json({ error: "Please check these.", fields }, { status: 400 });
    }
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  // A date in the past is a typo, not a request.
  const when = new Date(`${parsed.date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(when.getTime()) || when < today) {
    return NextResponse.json(
      { error: "Please check these.", fields: { date: "Choose today or a later date." } },
      { status: 400 },
    );
  }

  // Resolve what they want to see, so the record is about something real.
  let subject: MeetingRecord["subject"] = null;
  if (parsed.projectSlug) {
    const project = getProjectBySlug(parsed.projectSlug);
    if (project) subject = { kind: "project", slug: project.slug, label: project.name };
  } else if (parsed.propertySlug) {
    const property = getPropertyBySlug(parsed.propertySlug);
    if (property) subject = { kind: "property", slug: property.slug, label: property.title };
  }

  const record: MeetingRecord = {
    ...parsed,
    id: `mtg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    subject,
  };
  store().push(record);
  console.log(`[meetings] ${record.id} · ${record.mode} · ${record.date} ${record.slot}`);

  return NextResponse.json({
    id: record.id,
    date: record.date,
    slot: record.slot,
    mode: record.mode,
    subject: record.subject,
  });
}
