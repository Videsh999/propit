"use client";

import { useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Check, Heart, MessageCircle, Share2, X } from "lucide-react";
import { useDiscovery } from "@/store/discovery";
import { CompareToggle } from "@/components/compare/compare-toggle";

const ScheduleVisit = dynamic(() => import("@/components/home/schedule-visit").then(module => module.ScheduleVisit), { loading: () => <p role="status" className="py-8 text-sm text-muted">Opening enquiry…</p> });

export function DetailActions({ kind, id, slug, title }: { kind: "project" | "property"; id: string; slug: string; title: string }) {
  const saved = useDiscovery(state => kind === "project" ? state.savedProjectIds.includes(id) : state.savedIds.includes(id));
  const toggleSaved = useDiscovery(state => kind === "project" ? state.toggleSavedProject : state.toggleSaved);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const controlClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-raised px-4 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent";

  return <div className="flex flex-wrap items-center gap-2" aria-label={`${kind === "project" ? "Project" : "Property"} actions`}>
    <button type="button" onClick={() => { setOpen(true); dialog.current?.showModal(); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover"><MessageCircle size={16} />Enquire now</button>
    <button type="button" aria-pressed={saved} onClick={() => toggleSaved(id)} className={controlClass}><Heart size={16} fill={saved ? "currentColor" : "none"} className={saved ? "text-accent" : ""} />{saved ? "Saved" : "Save"}</button>
    {kind === "property" && <CompareToggle id={id} className="min-h-11 rounded-full px-4" />}
    <button type="button" aria-label={copied ? "Link copied" : "Copy link"} className={controlClass} onClick={async () => { try { await navigator.clipboard.writeText(`${location.origin}/${kind}/${slug}`); setCopied(true); setShareError(false); } catch { setShareError(true); } }}>{copied ? <Check size={16} /> : <Share2 size={16} />}<span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span></button>
    {shareError && <span role="status" className="text-xs text-muted">Copy the page address to share this {kind}.</span>}
    <dialog ref={dialog} onClose={() => setOpen(false)} aria-labelledby={titleId} className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-[620px] overflow-y-auto rounded-3xl border border-line bg-raised p-5 text-ink shadow-e3 backdrop:bg-black/35 backdrop:backdrop-blur-sm sm:p-7">
      <div className="mb-2 flex items-start justify-between gap-4"><div><p className="eyebrow">Let’s talk about your next home</p><h2 id={titleId} className="display mt-2 text-[28px] leading-tight">Enquire about {title}</h2></div><button type="button" aria-label="Close enquiry" onClick={() => dialog.current?.close()} className="grid min-h-11 min-w-11 place-items-center rounded-full border border-line"><X size={18} /></button></div>
      {open && <ScheduleVisit hideHeading propertySlug={kind === "property" ? slug : undefined} projectSlug={kind === "project" ? slug : undefined} initialMode="call" />}
    </dialog>
  </div>;
}
