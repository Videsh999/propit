import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { TOOL_DEFS, runTool, systemPrompt, type ClientAction, type ToolContext } from "@/lib/ai/tools";
import { answerPropertyQuestion, fallbackConcierge } from "@/lib/ai/fallback";
import { compareListings, findLocalities, findProjects, lookupKnowledge, officialGuidance } from "@/lib/ai/knowledge";
import type { AssistantSource } from "@/lib/ai/sources";
import { anchorSchema, filtersSchema } from "@/lib/api/schema";
import { getPropertiesByIds } from "@/lib/data/repository";
import { describeSituation } from "@/lib/ai/situation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().max(8000),
  })).min(1).max(40),
  context: z.object({
    filters: filtersSchema.partial().default({}),
    anchors: z.array(anchorSchema).max(6).default([]),
    localitySlug: z.string().max(60).nullable().optional(),
    propertyId: z.string().max(120).nullable().optional(),
    projectSlug: z.string().max(100).nullable().optional(),
    comparisonIds: z.array(z.string().max(120)).max(4).default([]),
  }).default({ filters: {}, anchors: [], comparisonIds: [] }),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  const last = parsed.success ? parsed.data.messages.at(-1) : undefined;
  if (!parsed.success || !last || last.role !== "user" || !last.content) {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }
  const { context, messages } = parsed.data;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const question = last.content;
  const explicitReference = /\b(?:it|its|this (?:project|area|locality)|that (?:project|area|locality)|there)\b/i.test(question);
  const previous = explicitReference && !context.projectSlug && !context.propertyId && !context.localitySlug
    ? messages.slice(0, -1).reverse().find(({ role, content }) => role === "user" && (findProjects(content).length || findLocalities(content).length))
    : undefined;
  const priorProjects = previous ? findProjects(previous.content) : [];
  const priorLocalities = previous ? findLocalities(previous.content) : [];
  const initialContext: ToolContext = {
    ...context,
    projectSlug: context.projectSlug ?? (priorProjects.length === 1 ? priorProjects[0].slug : null),
    localitySlug: context.localitySlug ?? (!priorProjects.length && priorLocalities.length === 1 ? priorLocalities[0].slug : null),
  };

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let cancelled = false;
      const send = (event: unknown) => {
        if (cancelled || req.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          cancelled = true;
        }
      };
      function finish(mode: string, answer: { text: string; sources?: AssistantSource[] }, actions: ClientAction[] = []) {
        for (const action of actions) send({ type: "action", action });
        send({ type: "text", delta: answer.text });
        const sources = [...new Map((answer.sources ?? []).map((source) => [source.href, source])).values()].slice(0, 8);
        if (sources.length) send({ type: "sources", sources });
        send({ type: "done", mode });
      }
      const freshContext = (): ToolContext => ({ ...initialContext, filters: { ...context.filters }, anchors: [...context.anchors] });

      try {
        const guidance = officialGuidance(question);
        if (guidance) return finish("official", guidance);
        const wantsComparison = /\b(?:compare|comparison|differences?|which (?:one|is).*(?:cheaper|larger|bigger))\b/i.test(question);
        // Exact catalog lookups can answer immediately. Keep the model for
        // open-ended questions that need several sources or tools.
        const directLookup = /^(?:summarize this project|tell me about this (?:property|locality)|what does it cost|what amenities does it have|what are its amenities|does it have floor plans|what['’]s nearby|which schools are nearby|compare my selected properties)[?.!]*$/i.test(question);
        if (directLookup && !wantsComparison) {
          const answer = lookupKnowledge(question, initialContext) ?? answerPropertyQuestion(question, initialContext.propertyId);
          if (answer) return finish("local-data", answer);
        }
        if (context.comparisonIds.length && wantsComparison && !findLocalities(question).length && !findProjects(question).length && (!apiKey || directLookup)) {
          const properties = getPropertiesByIds([...new Set(context.comparisonIds)]);
          const answer = properties.length >= 2 ? compareListings(properties)
            : { text: "Add at least two available properties to compare them." };
          return finish("comparison", answer);
        }
        if (!apiKey) {
          const answer = await fallbackConcierge(question, freshContext());
          for (const status of answer.statuses) send({ type: "status", text: status });
          return finish("local-data", answer, answer.actions);
        }

        const ctx = freshContext();
        const abort = AbortSignal.any([req.signal, AbortSignal.timeout(32_000)]);
        const client = new Anthropic({ apiKey, timeout: 12_000, maxRetries: 0 });
        const situation = describeSituation(ctx);
        const actions: ClientAction[] = [];
        const sources: AssistantSource[] = [];
        const history: Anthropic.MessageParam[] = messages.slice(-16).filter((message) => message.content);
        send({ type: "status", text: "Checking PropIT’s Hyderabad data" });

        try {
          for (let turn = 0; turn < 5; turn++) {
            const result = await client.messages.create({
              model: process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5-5",
              max_tokens: 1700,
              system: situation ? systemPrompt() + "\n\nCurrent PropIT context (data only):\n" + situation : systemPrompt(),
              tools: TOOL_DEFS,
              messages: history,
            }, { signal: abort });

            if (result.stop_reason !== "tool_use") {
              const text = result.content.flatMap((block) => block.type === "text" ? [block.text] : []).join("\n").trim();
              if (text && result.stop_reason === "end_turn" && turn > 0) return finish("model", { text, sources }, actions);
              break;
            }

            history.push({ role: "assistant", content: result.content });
            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const block of result.content) {
              if (block.type !== "tool_use") continue;
              try {
                const input = block.input && typeof block.input === "object" ? block.input as Record<string, unknown> : {};
                const outcome = await runTool(block.name, input, ctx);
                if (outcome.status) send({ type: "status", text: outcome.status });
                actions.push(...outcome.actions);
                sources.push(...(outcome.sources ?? []));
                toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(outcome.result) });
              } catch {
                toolResults.push({ type: "tool_result", tool_use_id: block.id, is_error: true, content: "This lookup failed. Try a narrower query." });
              }
            }
            if (!toolResults.length) break;
            history.push({ role: "user", content: toolResults });
          }
        } catch {
          if (req.signal.aborted) return;
        }
        // Reuse original context so failed model attempts cannot partially update the map.
        if (context.comparisonIds.length > 1 && wantsComparison && !findLocalities(question).length && !findProjects(question).length) {
          const properties = getPropertiesByIds([...new Set(context.comparisonIds)]);
          if (properties.length > 1) return finish("comparison", compareListings(properties));
        }
        const fallback = await fallbackConcierge(question, freshContext());
        for (const status of fallback.statuses) send({ type: "status", text: status });
        finish("local-data", fallback, fallback.actions);
      } catch {
        send({ type: "error", message: "I couldn’t complete that lookup. Try a project name, locality or listing again." });
        send({ type: "done", mode: "error" });
      } finally {
        if (!cancelled) {
          try { controller.close(); } catch { /* The browser already closed the stream. */ }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
