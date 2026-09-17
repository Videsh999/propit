import "server-only";
import { parseQuery } from "@/lib/search/parser";
import { getStore } from "@/lib/data/store";
import { runTool, type ClientAction, type ToolContext } from "./tools";
import { formatPrice, formatPriceSqft } from "@/lib/format";
import { localityIntelligence } from "@/lib/data/repository";

/**
 * Deterministic concierge used when no LLM key is configured.
 *
 * It is not a mock: it runs the same tools against the same data and returns
 * grounded answers with real map actions. Less conversational than the model,
 * equally truthful.
 */
export async function fallbackConcierge(
  message: string,
  ctx: ToolContext,
): Promise<{ text: string; actions: ClientAction[]; statuses: string[] }> {
  const store = getStore();
  const parsed = parseQuery(
    message,
    store.localities.map((l) => l.name),
  );
  const actions: ClientAction[] = [];
  const statuses: string[] = [];
  const lines: string[] = [];

  // --- anchor intent: "my office is in X", "school near Y" ---
  const anchorPatterns: { re: RegExp; kind: "office" | "school" | "family" | "gym"; label: string }[] = [
    { re: /\b(?:my\s+)?office\s+(?:is\s+)?(?:in|at|near)\s+([a-z][a-z0-9'.\- ]{2,40})/i, kind: "office", label: "Office" },
    { re: /\b(?:son|daughter|kid|child)(?:'s)?\s+school\s+(?:is\s+)?(?:in|at|near)\s+([a-z][a-z0-9'.\- ]{2,40})/i, kind: "school", label: "School" },
    { re: /\bschool\s+(?:is\s+)?(?:in|at|near)\s+([a-z][a-z0-9'.\- ]{2,40})/i, kind: "school", label: "School" },
    { re: /\b(?:parents|family)\s+(?:live\s+)?(?:in|at|near)\s+([a-z][a-z0-9'.\- ]{2,40})/i, kind: "family", label: "Family" },
  ];

  let addedAnchor = false;
  for (const p of anchorPatterns) {
    const m = message.match(p.re);
    if (!m) continue;
    const place = m[1].trim().replace(/\s+(and|with|,).*$/i, "");
    const out = await runTool(
      "add_anchor",
      { label: p.label, kind: p.kind, place, maxKm: parsed.radiusKm ?? 5 },
      ctx,
    );
    actions.push(...out.actions);
    if (out.status) statuses.push(out.status);
    const r = out.result as { added?: { resolvedTo: string; maxKm: number }; error?: string };
    if (r.added) {
      addedAnchor = true;
      lines.push(`Placed **${p.label}** at ${r.added.resolvedTo}, within ${r.added.maxKm} km.`);
    } else if (r.error) {
      lines.push(r.error);
    }
  }

  // --- locality question ---
  // "tell me about here" should work when a locality is already open.
  const mentionedLocality =
    parsed.localityMentions[0] ??
    (parsed.isQuestion && ctx.localitySlug
      ? store.localityBySlug.get(ctx.localitySlug)?.name
      : undefined);
  if (parsed.isQuestion && mentionedLocality) {
    const l = store.localities.find((x) => x.name === mentionedLocality)!;
    const intel = localityIntelligence(l.slug);
    if (intel) {
      actions.push({ type: "set_map_view", payload: { localitySlug: l.slug } });
      statuses.push(`Pulled data for ${l.name}`);
      lines.push(
        `**${l.name}** — ${l.character}.`,
        "",
        `Average ${formatPriceSqft(intel.stats.avgPriceSqft)} · median ${formatPrice(
          intel.stats.medianPrice,
        )} · ${intel.stats.inventory} homes across ${intel.stats.projects} projects.`,
        `Rental yield around ${intel.stats.rentalYieldPct}% and prices up ${intel.stats.momentumPct}% year on year. Those two figures are estimates from PropIT's own model, not audited data.`,
        "",
        intel.locality.summary,
      );
      if (intel.connectivity.length) {
        lines.push(
          "",
          "Connectivity: " +
            intel.connectivity
              .slice(0, 4)
              .map((c) => `${c.name} ${c.distanceKm} km`)
              .join(" · ") +
            ".",
        );
      }
      return { text: lines.join("\n"), actions, statuses };
    }
  }

  // --- zone recompute when anchors exist ---
  if (addedAnchor || ctx.anchors.length) {
    const prioritise = message.match(/priorit\w*\s+(?:my\s+)?(\w+)/i)?.[1];
    const out = await runTool("compute_livable_zone", prioritise ? { prioritise } : {}, ctx);
    actions.push(...out.actions);
    if (out.status) statuses.push(out.status);
    const r = out.result as {
      total: number;
      areaKm2: number;
      bestLocalities: { name: string; count: number; avgPriceSqft: number }[];
      relaxationOptions: { label: string; unlocks: number; message: string }[];
      routingIsEstimate: boolean;
    };

    if (r.total > 0) {
      lines.push(
        "",
        `That leaves **${r.total} ${r.total === 1 ? "home" : "homes"}** across roughly ${r.areaKm2} km².`,
      );
      if (r.bestLocalities.length) {
        lines.push(
          "",
          "Strongest areas: " +
            r.bestLocalities
              .slice(0, 3)
              .map((b) => `${b.name} (${b.count}, ${formatPriceSqft(b.avgPriceSqft)})`)
              .join(" · ") +
            ".",
        );
      }
      if (r.routingIsEstimate) {
        lines.push("", "_Travel times shown across PropIT are estimated from distance — routing isn't connected yet._");
      }
    } else if (r.relaxationOptions.length) {
      lines.push("", `Nothing matches every constraint yet. ${r.relaxationOptions[0].message}`);
    } else {
      lines.push("", "Nothing matches every constraint, and I couldn't find a small change that would help. Try widening a distance or the budget.");
    }
    return { text: lines.join("\n"), actions, statuses };
  }

  // --- plain search ---
  if (parsed.confidence >= 0.2) {
    const out = await runTool(
      "search_properties",
      {
        ...parsed.filters,
        ...(parsed.localityMentions.length
          ? {
              localitySlugs: parsed.localityMentions
                .map((n) => store.localities.find((l) => l.name === n)?.slug)
                .filter(Boolean),
            }
          : {}),
        ...(parsed.nearPlace ? { nearPlace: parsed.nearPlace } : {}),
        ...(parsed.radiusKm ? { radiusKm: parsed.radiusKm } : {}),
      },
      ctx,
    );
    actions.push(...out.actions);
    if (out.status) statuses.push(out.status);
    const r = out.result as {
      total: number;
      searchedAround: string | null;
      topResults: { title: string; locality: string; price: string; areaSqft: number }[];
    };

    if (r.total === 0) {
      lines.push(
        "Nothing matched that exactly. Try widening the budget or the area — tell me which you'd rather move and I'll adjust the map.",
      );
    } else {
      lines.push(
        `**${r.total} ${r.total === 1 ? "home" : "homes"}** match${r.total === 1 ? "es" : ""}${
          r.searchedAround ? ` around ${r.searchedAround}` : ""
        }. The map is showing them now.`,
      );
      if (r.topResults.length) {
        lines.push(
          "",
          ...r.topResults.slice(0, 3).map((t) => `· ${t.title} — ${t.locality}, ${t.price}, ${t.areaSqft} sq.ft`),
        );
      }
      lines.push("", "Want me to narrow this by distance from somewhere that matters to you?");
    }
    return { text: lines.join("\n"), actions, statuses };
  }

  // --- nothing actionable ---
  return {
    text: [
      "I can search PropIT's Hyderabad inventory and move the map for you. Try:",
      "",
      "· “3 BHK under 2 crore in Kokapet”",
      "· “My office is in Financial District” — I'll place it and find homes around it",
      "· “Tell me about Tellapur”",
      "· “Villas within 5 km of Gachibowli”",
      "",
      "_Full conversational answers need an Anthropic API key. Without one, I still run the real searches — I'm just more literal about it._",
    ].join("\n"),
    actions,
    statuses,
  };
}
