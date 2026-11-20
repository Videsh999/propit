import { isProductionDeployment } from "@/lib/deployment";
import { checkProduction } from "@/lib/production-check";

export const dynamic = "force-dynamic";
let cached: { ready: boolean; until: number } | null = null;
let pending: Promise<boolean> | null = null;
export async function GET() {
  const production = isProductionDeployment();
  if (!production) return Response.json({ status: "preview", productionReady: false }, { headers: { "Cache-Control": "no-store" } });
  if (!cached || cached.until < Date.now()) {
    pending ??= checkProduction().then(failures => failures.length === 0).catch(() => false).finally(() => { pending = null; });
    const ready = await pending;
    cached = { ready, until: Date.now() + 30_000 };
  }
  return Response.json({ status: cached.ready ? "ready" : "unavailable", productionReady: cached.ready }, { status: cached.ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
