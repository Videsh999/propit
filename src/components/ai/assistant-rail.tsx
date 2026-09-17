"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles, X, ArrowUp, Check, Loader2 } from "lucide-react";
import { useDiscovery } from "@/store/discovery";
import { useProperties } from "@/lib/hooks/use-properties";
import type { Anchor, PropertyFilters } from "@/types";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
  statuses?: string[];
  pending?: boolean;
}

const STARTERS = [
  "My office is in Financial District",
  "3 BHK under 2 crore near Hitech City",
  "Tell me about Tellapur",
  "Villas within 5 km of Gachibowli",
];

export function AssistantRail() {
  const {
    assistantOpen, setAssistantOpen, filters, anchors,
    selectedLocalitySlug, selectedPropertyId,
    setFilters, addAnchor, removeAnchor, clearAnchors, setRadius,
    flyTo, select, setUseBounds, toggleLayer, toggleCompare, clearCompare,
  } = useDiscovery();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const localitiesRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());
  const resultCountRef = useRef<number | null>(null);
  // Kept in a ref so a changing count never re-renders the transcript.
  const { data: liveResults } = useProperties({ limit: 1, enabled: assistantOpen });
  resultCountRef.current = liveResults?.total ?? null;

  useEffect(() => {
    if (!assistantOpen || localitiesRef.current.size) return;
    fetch("/api/localities")
      .then((r) => r.json())
      .then((j: { localities: { slug: string; center: { lat: number; lng: number } }[] }) => {
        for (const l of j.localities) localitiesRef.current.set(l.slug, l.center);
      })
      .catch(() => {});
  }, [assistantOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  /** Apply a command the assistant issued — this is how it drives the map. */
  const applyAction = useCallback(
    (action: { type: string; payload: Record<string, unknown> }) => {
      switch (action.type) {
        case "set_filters":
          setUseBounds(false);
          setFilters(action.payload as Partial<PropertyFilters>);
          break;
        case "add_anchor":
          addAnchor(action.payload as unknown as Anchor);
          break;
        case "remove_anchor":
          removeAnchor(action.payload.id as string);
          break;
        case "clear_anchors":
          clearAnchors();
          break;
        case "set_radius": {
          const center = action.payload.center as { lat: number; lng: number };
          setUseBounds(false);
          setRadius({
            center,
            km: action.payload.radiusKm as number,
            label: (action.payload.label as string) || "Search centre",
          });
          flyTo(center, 12.4);
          break;
        }
        case "set_map_view": {
          const slug = action.payload.localitySlug as string | undefined;
          if (slug) {
            const c = localitiesRef.current.get(slug);
            if (c) flyTo(c, 13.2);
          } else if (action.payload.lat != null) {
            flyTo(
              { lat: action.payload.lat as number, lng: action.payload.lng as number },
              (action.payload.zoom as number) ?? 13,
            );
          }
          break;
        }
        case "select_property":
          select(action.payload.id as string);
          break;
        case "set_compare":
          clearCompare();
          for (const id of (action.payload.ids as string[]) ?? []) toggleCompare(id);
          break;
        case "toggle_layer":
          toggleLayer(action.payload.layer as never);
          break;
      }
    },
    [setFilters, addAnchor, removeAnchor, clearAnchors, setRadius, flyTo, select, setUseBounds, toggleLayer, toggleCompare, clearCompare],
  );

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    setBusy(true);

    const history = [...messages, { role: "user" as const, content: trimmed }];
    setMessages([...history, { role: "assistant", content: "", statuses: [], pending: true }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          context: {
            filters,
            anchors,
            localitySlug: selectedLocalitySlug,
            propertyId: selectedPropertyId,
            resultCount: resultCountRef.current,
          },
        }),
      });
      if (!res.ok || !res.body) throw new Error("unavailable");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          let evt: { type: string; delta?: string; text?: string; action?: { type: string; payload: Record<string, unknown> }; message?: string };
          try {
            evt = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }

          if (evt.type === "text" && evt.delta) {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              next[next.length - 1] = { ...last, content: last.content + evt.delta };
              return next;
            });
          } else if (evt.type === "status" && evt.text) {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              next[next.length - 1] = { ...last, statuses: [...(last.statuses ?? []), evt.text!] };
              return next;
            });
          } else if (evt.type === "action" && evt.action) {
            applyAction(evt.action);
          } else if (evt.type === "error" && evt.message) {
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = { role: "assistant", content: evt.message! };
              return next;
            });
          } else if (evt.type === "done") {
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = { ...next[next.length - 1], pending: false };
              return next;
            });
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content:
            "I couldn't reach the assistant just then. Search, filters and anchors all still work — try again in a moment.",
        };
        return next;
      });
    } finally {
      setBusy(false);
      setMessages((prev) => {
        const next = [...prev];
        if (next.length) next[next.length - 1] = { ...next[next.length - 1], pending: false };
        return next;
      });
    }
  }

  return (
    <AnimatePresence>
      {assistantOpen && (
        <motion.aside
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="fixed right-0 top-0 z-[70] flex h-full w-full max-w-[400px] flex-col border-l border-line bg-paper"
          aria-label="PropIT assistant"
        >
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-[var(--accent-ink)]">
                <Sparkles size={13} strokeWidth={2} />
              </span>
              <div>
                <h2 className="text-[14px] font-medium text-ink">PropIT</h2>
                <p className="text-[11px] text-faint">Grounded in real listings</p>
              </div>
            </div>
            <button
              onClick={() => setAssistantOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-[var(--r-sm)] text-faint hover:bg-sunk hover:text-ink"
              aria-label="Close assistant"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </header>

          <div ref={scrollRef} className="scroll-quiet flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {messages.length === 0 && (
              <div>
                <p className="display text-[24px] leading-tight text-ink">
                  Tell me where
                  <br />
                  your life happens.
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-muted">
                  I can place your office and your child&apos;s school on the map, work out the area
                  that satisfies both, and show you what&apos;s inside it.
                </p>
                <div className="mt-5 space-y-1.5">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="block w-full rounded-[var(--r-sm)] border border-line bg-raised px-3 py-2 text-left text-[13px] text-muted transition-colors hover:border-line-strong hover:text-ink"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i}>
                {m.role === "user" ? (
                  <div className="ml-auto w-fit max-w-[88%] rounded-[var(--r-md)] rounded-br-[3px] bg-inverse px-3.5 py-2.5 text-[14px] leading-relaxed text-[var(--ink-inverse)]">
                    {m.content}
                  </div>
                ) : (
                  <div>
                    {m.statuses?.map((s, j) => (
                      <div key={j} className="mb-1.5 flex items-center gap-1.5 text-[12px] text-faint">
                        <Check size={11} strokeWidth={2} className="text-[var(--accent)]" />
                        {s}
                      </div>
                    ))}
                    {m.content ? (
                      <AssistantText text={m.content} />
                    ) : m.pending ? (
                      <div className="flex items-center gap-1.5 text-[13px] text-faint">
                        <Loader2 size={13} className="animate-spin" />
                        Thinking…
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-line p-3"
          >
            <div className="flex items-end gap-2 rounded-[var(--r-md)] border border-line bg-raised p-2 focus-within:border-[var(--accent-line)]">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder="Ask about prices, areas, or what fits your life…"
                aria-label="Message PropIT"
                className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent px-1 text-[14px] text-ink outline-none placeholder:text-faint"
              />
              <button
                type="submit"
                disabled={!input.trim() || busy}
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-sm)] transition-colors",
                  input.trim() && !busy
                    ? "bg-accent text-[var(--accent-ink)] hover:bg-accent-hover"
                    : "bg-sunk text-faint",
                )}
                aria-label="Send"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={14} strokeWidth={2.5} />}
              </button>
            </div>
            <p className="mt-2 px-1 text-[11px] leading-relaxed text-faint">
              PropIT answers from its own listings. Figures it can&apos;t verify are labelled — and it
              won&apos;t invent one.
            </p>
          </form>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/** Minimal, safe formatting: paragraphs, bullets and **bold**. No HTML injection. */
function AssistantText({ text }: { text: string }) {
  const blocks = text.split("\n").filter((l) => l.trim() !== "");
  return (
    <div className="space-y-2 text-[14px] leading-relaxed text-ink">
      {blocks.map((line, i) => {
        const bullet = line.trimStart().startsWith("·") || line.trimStart().startsWith("-");
        const content = bullet ? line.trimStart().slice(1).trim() : line;
        const parts = content.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).filter(Boolean);
        const rendered = parts.map((p, j) => {
          if (p.startsWith("**") && p.endsWith("**")) {
            return (
              <strong key={j} className="font-semibold">
                {p.slice(2, -2)}
              </strong>
            );
          }
          if (p.startsWith("_") && p.endsWith("_")) {
            return (
              <em key={j} className="text-[12px] not-italic text-faint">
                {p.slice(1, -1)}
              </em>
            );
          }
          return <span key={j}>{p}</span>;
        });
        return bullet ? (
          <div key={i} className="flex gap-2 pl-1">
            <span className="text-faint">·</span>
            <span>{rendered}</span>
          </div>
        ) : (
          <p key={i}>{rendered}</p>
        );
      })}
    </div>
  );
}
