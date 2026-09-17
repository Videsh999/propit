import { NextResponse } from "next/server";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
 * Development-only sink for the map diagnostic.
 *
 * "The map is blank" is only answerable from inside the browser that is showing
 * it, and a screenshot cannot say whether a tile request was made. So the
 * diagnostic page posts its findings here and they land in a file, which makes
 * debugging a one-URL round trip instead of a conversation.
 *
 * Refuses to run outside development: nothing in production should be able to
 * write a file into the project directory.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed report." }, { status: 400 });
  }

  const file = path.join(process.cwd(), ".propit-diag.json");
  await writeFile(file, JSON.stringify(body, null, 2), "utf8");
  console.log(`[diag] map report written to ${file}`);
  return NextResponse.json({ ok: true });
}
