import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { serverDatabase } from "@/lib/supabase/server";
import { requestBudget } from "@/lib/api/rate-limit";
import { HttpError } from "@/lib/api/http";

export async function submissionIdentity(request: Request) {
  const database = await serverDatabase();
  if (!database) throw new HttpError(503, "Requests are not enabled in this preview.", "service_not_configured");
  const { data, error } = await database.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Please sign in to send this request.", "sign_in_required");
  await requestBudget(request, "write", data.user.id);
  return { database, user: data.user };
}

export async function saveSubmission(request: Request, identity: Awaited<ReturnType<typeof submissionIdentity>>, table: "viewing_requests" | "listing_submissions", payload: object, subject?: object | null) {
  const requestKey = z.string().uuid().safeParse(request.headers.get("idempotency-key"));
  if (!requestKey.success) throw new HttpError(400, "A valid request reference is required.", "invalid_reference");
  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const { database, user } = identity;
  const fields = "id,status,created_at,payload_hash";
  const { data, error } = await database.from(table).insert({ user_id: user.id, request_key: requestKey.data, payload, payload_hash: hash, ...(table === "viewing_requests" ? { subject: subject ?? null } : {}) }).select(fields).single();
  if (!error && data) return data;
  if (error?.code !== "23505") throw error ?? new Error("Request was not saved.");
  const existing = await database.from(table).select(fields).eq("user_id", user.id).eq("request_key", requestKey.data).single();
  if (existing.error || !existing.data) throw existing.error ?? new Error("Request lookup failed.");
  if (existing.data.payload_hash !== hash) throw new HttpError(409, "This request reference was already used for different details.", "request_conflict");
  return existing.data;
}
