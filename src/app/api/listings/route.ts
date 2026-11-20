import { listingSubmissionSchema } from "@/lib/submissions/schema";
import { readJson, apiError, HttpError } from "@/lib/api/http";
import { submissionIdentity, saveSubmission } from "@/lib/submissions/save";
import { prepareStore, getStore } from "@/lib/data/store";
import { AMENITIES } from "@/lib/data/developers";
import { haversineKm } from "@/lib/geo/distance";

export async function POST(request: Request) {
  try {
    const parsed = listingSubmissionSchema.safeParse(await readJson(request));
    if (!parsed.success) return Response.json({ error: "Please check your listing details.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const identity = await submissionIdentity(request);
    await prepareStore();
    const listing = parsed.data, locality = getStore().localityBySlug.get(listing.localitySlug);
    if (!locality) throw new HttpError(400, "Choose an available locality.");
    if (haversineKm(locality.center, listing.location) > 30) throw new HttpError(400, "Move the property pin closer to the selected locality.");
    if (listing.amenities.some(amenity => !AMENITIES.some(item => item.slug === amenity))) throw new HttpError(400, "Choose amenities from the available options.");
    const record = await saveSubmission(request, identity, "listing_submissions", listing);
    return Response.json({ id: record.id, status: record.status }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
