import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { catalogSchema } from "../src/lib/data/catalog-schema";
import { supabaseConfig } from "../src/lib/deployment";

async function main() {
const [file, source, confirmation] = process.argv.slice(2);
if (!file || !source || source.trim().length < 3 || source.length > 200 || confirmation !== "--approved-real-listings") throw new Error("Usage: npm run catalog:publish -- /private/path/catalog.json 'Approved source name' --approved-real-listings. Never publish generated showcase inventory.");
const bytes = await readFile(file);
if (bytes.length > 20_000_000) throw new Error("Catalog exceeds 20MB. Split the catalog architecture before increasing this limit.");
const catalog = catalogSchema.parse(JSON.parse(bytes.toString("utf8")));
if (catalog.city.slug !== "hyderabad") throw new Error("Only Hyderabad is supported.");
const config = supabaseConfig(), secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!config || !secret) throw new Error("Configure the Supabase URL and keys through the server environment.");
const database = createClient(config.url, secret, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(30_000) }) } });
const result = await database.from("catalog_snapshots").insert({ city_slug: "hyderabad", payload: catalog, source_name: source.trim() }).select("id").single();
if (result.error || !result.data) throw new Error("Catalog upload failed; existing published data was retained.");
const publication = await database.rpc("publish_catalog", { snapshot_id: result.data.id });
if (publication.error) throw new Error("Catalog publication failed; the upload remains a private draft.");
console.log(`Published ${catalog.properties.length} approved listings. Snapshot: ${result.data.id}. Runtime caches refresh within 60 seconds.`);
}
void main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Catalog publication failed."); process.exitCode = 1; });
