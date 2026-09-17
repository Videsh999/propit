import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { TOOL_DEFS, runTool, systemPrompt, type ClientAction, type ToolContext } from "@/lib/ai/tools";
import { fallbackConcierge } from "@/lib/ai/fallback";
import { anchorSchema, filtersSchema } from "@/lib/api/schema";
import { describeSituation } from "@/lib/ai/situation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .min(1)
    .max(40),
  context: z
    .object({
      filters: filtersSchema.partial().default({}),
      anchors: z.array(anchorSchema).max(6).default([]),
      // What the user is currently looking at, so they never have to repeat it.
      localitySlug: z.string().max(60).nullable().default(null),
      propertyId: z.string().max(80).nullable().default(null),
      resultCount: z.number().int().nonnegative().nullable().default(null),
    })
    .default({ filters: {}, anchors: [], localitySlug: null, propertyId: null, resultCount: null }),
});

function sse(controller: ReadableStreamDefaultController, event: unknown) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
}

export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Malformed request." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ctx: ToolContext = {
    filters: { ...body.context.filters },
    anchors: [...body.context.anchors],
    localitySlug: body.context.localitySlug,
    propertyId: body.context.propertyId,
  };
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const stream = new ReadableStream({
    async start(controller) {
      const done = (extra: Record<string, unknown> = {}) => {
        sse(controller, { type: "done", ...extra });
        controller.close();
      };

      // ---- No key: deterministic concierge over the same tools/data ----
      if (!apiKey) {
        try {
          const last = body.messages[body.messages.length - 1];
          const out = await fallbackConcierge(last.content, ctx);
          for (const s of out.statuses) sse(controller, { type: "status", text: s });
          for (const a of out.actions) sse(controller, { type: "action", action: a });
          // Stream in chunks so the transcript animates like the real thing.
          const words = out.text.split(" ");
          for (let i = 0; i < words.length; i += 3) {
            sse(controller, { type: "text", delta: words.slice(i, i + 3).join(" ") + " " });
            await new Promise((r) => setTimeout(r, 12));
          }
          done({ mode: "fallback" });
        } catch (err) {
          console.error("[ai/chat fallback]", err);
          sse(controller, { type: "error", message: "I couldn't complete that. Try rephrasing?" });
          done();
        }
        return;
      }

      // ---- Model with tool use ----
      try {
        // A hanging model call would leave the user watching a spinner, so cap
        // it well inside the route's own budget and let the deterministic
        // concierge take over instead.
        const client = new Anthropic({ apiKey, timeout: 25_000, maxRetries: 1 });
        const messages: Anthropic.MessageParam[] = body.messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const situation = describeSituation(body.context);

        const allActions: ClientAction[] = [];

        for (let turn = 0; turn < 6; turn++) {
          const res = await client.messages.create({
            model: "claude-sonnet-5",
            max_tokens: 1600,
            system: situation ? `${systemPrompt()}\n\n## What the user is looking at right now\n\n${situation}` : systemPrompt(),
            tools: TOOL_DEFS,
            messages,
          });

          for (const block of res.content) {
            if (block.type === "text") {
              sse(controller, { type: "text", delta: block.text });
            }
          }

          if (res.stop_reason !== "tool_use") {
            done({ mode: "model", actions: allActions.length });
            return;
          }

          const toolUses = res.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
          );
          messages.push({ role: "assistant", content: res.content });

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            const outcome = await runTool(tu.name, tu.input as Record<string, unknown>, ctx);
            if (outcome.status) sse(controller, { type: "status", text: outcome.status });
            for (const a of outcome.actions) {
              allActions.push(a);
              sse(controller, { type: "action", action: a });
            }
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: JSON.stringify(outcome.result).slice(0, 12000),
            });
          }
          messages.push({ role: "user", content: toolResults });
        }

        done({ mode: "model", truncated: true });
      } catch (err) {
        // One line, not a stack: an unreachable model is an expected condition
        // here, and the request still succeeds via the fallback below.
        const reason = err instanceof Error ? err.message : String(err);
        console.warn(`[ai/chat] model unavailable (${reason}); using the deterministic concierge`);
        // Degrade to the deterministic concierge rather than failing outright.
        try {
          const last = body.messages[body.messages.length - 1];
          const out = await fallbackConcierge(last.content, ctx);
          for (const a of out.actions) sse(controller, { type: "action", action: a });
          sse(controller, { type: "text", delta: out.text });
          done({ mode: "fallback-after-error" });
        } catch {
          sse(controller, {
            type: "error",
            message: "The assistant is unavailable right now. Search and filters still work.",
          });
          done();
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
