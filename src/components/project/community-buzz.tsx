import Link from "next/link";
import { Gavel, House, Megaphone, Newspaper, ShieldCheck } from "lucide-react";
import { publishedCommunityUpdates } from "@/lib/data/community";
import { formatArea, formatPrice } from "@/lib/format";
import type { CommunityUpdate } from "@/types";

const TYPES = { auction: { label: "Auction spotlight", icon: Gavel }, sale: { label: "Notable sale", icon: House }, news: { label: "Community news", icon: Newspaper }, milestone: { label: "Project milestone", icon: Megaphone } };
export function CommunityBuzz({ updates, saleCount, rentCount }: { updates?: CommunityUpdate[]; saleCount: number; rentCount: number }) {
  const published = publishedCommunityUpdates(updates);
  return <div>
    <p className="mb-5 max-w-[68ch] text-[16px] leading-relaxed text-muted">Notable sales, auction updates and the stories shaping this community.</p>
    {published.length ? <div className="grid gap-4 md:grid-cols-2">{published.map((update, index) => { const { label, icon: Icon } = TYPES[update.category]; return <article key={update.id} className={`rounded-2xl border border-line p-5 ${index === 0 ? "bg-accent-wash md:col-span-2" : "bg-paper"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted"><span className="inline-flex items-center gap-2 font-semibold text-accent"><Icon size={16} />{label}</span><time dateTime={update.publishedAt}>{new Date(update.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}</time></div>
      <h3 className="mt-3 text-xl font-semibold tracking-tight">{update.title}</h3><p className="mt-3 text-[16px] leading-relaxed text-muted">{update.summary}</p>
      {(update.amount || update.configuration || update.areaSqft) && <p className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-accent">{update.amount && <span>{formatPrice(update.amount)}</span>}{update.configuration && <span>{update.configuration}</span>}{update.areaSqft && <span>{formatArea(update.areaSqft)}</span>}</p>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-xs text-muted"><span className="flex items-center gap-1"><ShieldCheck size={13} />Source checked</span><a href={update.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center font-semibold text-accent">Read at {update.sourceName}</a></div>
    </article>; })}</div> : <div className="grid items-center gap-5 rounded-2xl border border-line bg-paper p-5 sm:grid-cols-[1fr_auto]"><div><span className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-accent"><Newspaper size={20} />Stay in the know</span><h3 className="text-xl font-semibold">Every community has a story.</h3><p className="mt-2 max-w-[54ch] text-sm leading-relaxed text-muted">No community news has been published yet. Explore the homes currently listed in this project.</p></div><Link href="#inventory" className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-raised px-5 text-sm font-semibold text-accent">{saleCount} for sale · {rentCount} for rent</Link></div>}
  </div>;
}
