import { requestOrigin } from "@/lib/deployment";
import { z } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = "request_failed") { super(message); }
}

export function checkSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") throw new HttpError(403, "This request must come from PropIT.", "origin_rejected");
  if (!origin) return; // Non-browser clients still face authentication and rate limits.
  const allowed = requestOrigin(request);
  if (!allowed || origin !== allowed) throw new HttpError(403, "This request must come from PropIT.", "origin_rejected");
}

export async function readJson(request: Request, limit = 32_768): Promise<unknown> {
  checkSameOrigin(request);
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? "")) throw new HttpError(415, "Send JSON with Content-Type application/json.", "unsupported_type");
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > limit)) throw new HttpError(413, "This request is too large.", "body_too_large");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "A JSON body is required.", "invalid_json");
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new HttpError(413, "This request is too large.", "body_too_large"); }
      parts.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Malformed JSON request.", "invalid_json");
  } finally { reader.releaseLock(); }
}

export function apiError(error: unknown): Response {
  if (error instanceof z.ZodError) return apiError(new HttpError(400, "Invalid request parameters.", "invalid_parameters"));
  if (error instanceof HttpError) return Response.json({ error: error.message, code: error.code }, {
    status: error.status,
    headers: { "Cache-Control": "private, no-store", ...(error.status === 429 ? { "Retry-After": "60" } : {}) },
  });
  const id = crypto.randomUUID();
  console.error(JSON.stringify({ event: "api_failure", id, name: error instanceof Error ? error.name : "UnknownError" }));
  return Response.json({ error: "The service is temporarily unavailable. Please try again.", reference: id }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
}
