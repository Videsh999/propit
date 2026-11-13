"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { MessageCircle, X, ArrowUp, ArrowUpRight, Check, Loader2 } from "lucide-react";
import { useDiscovery } from "@/store/discovery";
import type { AssistantSource } from "@/lib/ai/sources";
import type { Anchor, PropertyFilters } from "@/types";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
  statuses?: string[];
  pending?: boolean;
  sources?: AssistantSource[];
}

const STARTERS = [
  "My office is in Financial District",
  "Find 3 BHK homes under ₹2 Cr in Kokapet",
  "Compare Gachibowli and Tellapur",
  "How do I check a project’s RERA registration?",
];

export function AssistantRail() {
  const {
    assistantOpen, setAssistantOpen, assistantDraft, setAssistantDraft, filters, anchors,
    selectedLocalitySlug, selectedPropertyId, viewedProperty, previewProperty, compareIds,
    setFilters, addAnchor, removeAnchor, clearAnchors, setRadius,
    flyTo, select, setUseBounds, setPolygon, setDrawMode, toggleLayer, addToCompare, clearCompare,
  } = useDiscovery();
  const pathname = usePathname();
  const activeDetail = viewedProperty && pathname === `/property/${viewedProperty.slug}` ? viewedProperty : null;
  const onDiscovery = pathname === "/" || pathname === "/search";
  const projectSlug = pathname.match(/^\/project\/([^/]+)$/)?.[1] ?? null;
  const localitySlug = pathname.match(/^\/locality\/([^/]+)$/)?.[1]
    ?? (onDiscovery ? selectedLocalitySlug ?? (filters.localitySlugs.length === 1 ? filters.localitySlugs[0] : null) : null);
  const propertyId = activeDetail?.id ?? (onDiscovery ? selectedPropertyId : null);
  const propertyTitle = activeDetail?.title ?? (onDiscovery && previewProperty?.id === propertyId ? previewProperty?.title : null);
  const activeContext = propertyTitle ?? (projectSlug ? "Project details" : localitySlug ? "Locality details" : pathname === "/compare" ? "Property comparison" : "Hyderabad property assistant");
  const propertyPrompts = ["Tell me about this property", "What does it cost?", "What amenities does it have?", "What’s nearby?"];
  const prompts = propertyId ? propertyPrompts : projectSlug
    ? ["Summarize this project", "What are its amenities?", "Does it have floor plans?", "Which schools are nearby?"]
    : pathname === "/compare" && compareIds.length > 1
      ? ["Compare my selected properties", "Which one is cheaper?"]
      : localitySlug ? ["Tell me about this locality", "What is the average rent here?", "Which metro stations are nearby?"] : STARTERS;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const composerValue = assistantDraft ?? input;
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const localitiesRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());

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
        case "clear_search_geometry":
          select(null);
          setRadius(null);
          setPolygon(null);
          setDrawMode("none");
          setUseBounds(false);
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
          for (const id of (action.payload.ids as string[]) ?? []) addToCompare(id);
          break;
        case "toggle_layer":
          toggleLayer(action.payload.layer as never);
          break;
      }
    },
    [setFilters, addAnchor, removeAnchor, clearAnchors, setRadius, flyTo, select, setUseBounds, setPolygon, setDrawMode, toggleLayer, addToCompare, clearCompare],
  );

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    setAssistantDraft(null);
    setBusy(true);

    const history = [...messages, { role: "user" as const, content: trimmed }];
    setMessages([...history, { role: "assistant", content: "", statuses: [], pending: true }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.slice(-39).map((m) => ({ role: m.role, content: m.content.slice(0, 8000) })),
          context: {
            filters,
            anchors,
            localitySlug,
            propertyId,
            projectSlug,
            comparisonIds: pathname === "/compare" ? compareIds : [],
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
          let evt: { type: string; delta?: string; text?: string; action?: { type: string; payload: Record<string, unknown> }; message?: string; sources?: AssistantSource[] };
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
          } else if (evt.type === "sources" && Array.isArray(evt.sources)) {
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = { ...next[next.length - 1], sources: evt.sources };
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
    <>
      {!assistantOpen && (
        <button type="button" onClick={() => setAssistantOpen(true)}
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[45] inline-flex size-11 items-center justify-center gap-2 rounded-full min-[480px]:h-12 min-[480px]:w-auto min-[480px]:px-4 border border-[#326450] bg-[#153e30] text-sm font-semibold text-white shadow-[0_6px_24px_#102e2a38] transition-colors hover:bg-[#245640] sm:bottom-6 sm:right-6"
          aria-label="Ask PropIT" aria-controls="propit-assistant" aria-expanded={false}>
          <MessageCircle size={17} aria-hidden="true" className="text-[#bce6d1]" /><span className="hidden min-[480px]:inline">Ask PropIT</span>
        </button>
      )}
      <AnimatePresence>
      {assistantOpen && (
        <motion.aside
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 24, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          id="propit-assistant"
          className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-3 z-[70] flex h-[min(640px,calc(100dvh_-_3rem_-_env(safe-area-inset-bottom)))] w-[calc(100%_-_24px)] max-w-[390px] flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-[var(--e3)] sm:bottom-6 sm:right-6"
          aria-label="PropIT assistant"
          onKeyDown={(event) => {
            if (event.key === "Escape") setAssistantOpen(false);
          }}
        >
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[var(--accent-ink)]">
                <MessageCircle size={13} strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <h2 className="text-[14px] font-semibold text-ink">Ask PropIT</h2>
                <p className="truncate text-[11px] text-faint">{activeContext}</p>
              </div>
            </div>
            <button
              onClick={() => setAssistantOpen(false)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-sm)] text-faint hover:bg-sunk hover:text-ink"
              aria-label="Close assistant"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </header>

          <div ref={scrollRef} className="scroll-quiet min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {messages.length === 0 && (
              <div>
                {propertyId ? (
                  <>
                    <p className="display text-[24px] leading-tight text-ink">What would you like to know?</p>
                    <p className="mt-3 text-[13px] leading-relaxed text-muted">Ask about the home you’re viewing, from the listed price to nearby places.</p>
                  </>
                ) : <>
                <p className="display text-[24px] leading-tight text-ink">Explore Hyderabad real estate</p>
                <p className="mt-3 text-[13px] leading-relaxed text-muted">
                  Ask about a project, compare localities, or find homes around the places you visit.
                </p>
                </>}
                <div className="mt-5 space-y-1.5">
                  {prompts.map((s) => (
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

            {messages.length > 0 && propertyId && (
              <button disabled={busy} onClick={() => send(propertyPrompts[0])} className="rounded-full border border-line bg-raised px-3 py-1.5 text-[12px] font-medium text-accent disabled:opacity-50">
                {propertyPrompts[0]}
              </button>
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
                      <>
                        <AssistantText text={m.content} />
                        {m.sources?.length ? <SourceLinks sources={m.sources} /> : null}
                      </>
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
              send(composerValue);
            }}
            className="border-t border-line p-3"
          >
            <div className="flex items-end gap-2 rounded-[var(--r-md)] border border-line bg-raised p-2 focus-within:border-[var(--accent-line)]">
              <textarea
                value={composerValue}
                onChange={(e) => { setAssistantDraft(null); setInput(e.target.value); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(composerValue);
                  }
                }}
                rows={1}
                maxLength={8000}
                placeholder={propertyId ? "Ask about this home…" : "Ask about homes or localities…"}
                aria-label="Message PropIT"
                className="max-h-32 min-h-[24px] min-w-0 flex-1 resize-none bg-transparent px-1 text-[14px] text-ink outline-none placeholder:text-faint"
              />
              <button
                type="submit"
                disabled={!composerValue.trim() || busy}
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-[var(--r-sm)] transition-colors",
                  composerValue.trim() && !busy
                    ? "bg-accent text-[var(--accent-ink)] hover:bg-accent-hover"
                    : "bg-sunk text-faint",
                )}
                aria-label="Send"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={14} strokeWidth={2.5} />}
              </button>
            </div>
            <p className="mt-2 px-1 text-[11px] leading-relaxed text-faint">
              PropIT showcase prices and availability are illustrative. Official checks are linked when available.
            </p>
          </form>
        </motion.aside>
      )}
      </AnimatePresence>
    </>
  );
}

function SourceLinks({ sources }: { sources: AssistantSource[] }) {
  return (
    <ul aria-label="Sources" className="mt-3 grid gap-1.5">
      {sources.map(({ label, href, kind }) => {
        const className = "flex min-h-9 items-center justify-between gap-2 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-xs font-medium text-accent hover:border-accent";
        const content = <><span className="min-w-0">{label}<small className="ml-1.5 text-[10px] text-muted">{kind === "official" ? "Official" : "Showcase"}</small></span><ArrowUpRight size={13} className="shrink-0" aria-hidden="true" /></>;
        return <li key={href}>{kind === "official"
          ? <a href={href} className={className} target="_blank" rel="noopener noreferrer">{content}</a>
          : <Link href={href} className={className}>{content}</Link>}
        </li>;
      })}
    </ul>
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
