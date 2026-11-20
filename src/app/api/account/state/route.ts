import { z } from "zod";
import { serverDatabase } from "@/lib/supabase/server";
import { accountStateSchema, EMPTY_ACCOUNT_STATE } from "@/lib/account/schema";
import { readJson, apiError, HttpError } from "@/lib/api/http";
import { requestBudget } from "@/lib/api/rate-limit";

async function identity() {
  const database = await serverDatabase();
  if (!database) throw new HttpError(503, "Account sync is not available yet.");
  const { data, error } = await database.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Please sign in to access your account.");
  return { database, user: data.user };
}
async function current(database: NonNullable<Awaited<ReturnType<typeof serverDatabase>>>, userId: string) {
  const { data, error } = await database.from("customer_states").select("state,version").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ? { state: accountStateSchema.parse(data.state), version: Number(data.version) } : { state: EMPTY_ACCOUNT_STATE, version: 0 };
}
const privateHeaders = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  try { const { database, user } = await identity(); await requestBudget(request, "account", user.id);
    return Response.json(await current(database, user.id), { headers: privateHeaders });
  } catch (error) { return apiError(error); }
}
export async function PUT(request: Request) {
  try {
    const body = z.object({ state: accountStateSchema, version: z.number().int().nonnegative().max(2147483646) }).safeParse(await readJson(request, 131072));
    if (!body.success) throw new HttpError(400, "Invalid saved account data.");
    const { database, user } = await identity(); await requestBudget(request, "account", user.id);
    const { data, error } = await database.rpc("save_customer_state", { expected_version: body.data.version, next_state: body.data.state });
    if (error) throw error;
    if (!data) return Response.json(await current(database, user.id), { status: 409, headers: privateHeaders });
    return Response.json(data, { headers: privateHeaders });
  } catch (error) { return apiError(error); }
}
