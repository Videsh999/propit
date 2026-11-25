"use client";
import { useState } from "react";
import { BookOpen, FileText } from "lucide-react";
import { Img } from "@/components/ui/img";

export function ProjectBrochure({ name, builder, description, image, configurations, url, pages = [] }: { name: string; builder: string; description: string; image: string; configurations: string[]; url?: string; pages?: string[] }) {
  const [open, setOpen] = useState(false);
  const imageUrl = url && /\.(png|jpe?g|webp|avif)(?:[?#]|$)/i.test(url) ? url : null;
  return <div>
    <p className="mb-5 text-[16px] leading-relaxed text-muted">Read the project information here, at your own pace.</p>
    {pages.length ? <div className="space-y-4">{pages.map((page, index) => <Img key={page} src={page} alt={`${name} brochure page ${index + 1}`} className="mx-auto aspect-[3/4] w-full max-w-3xl rounded-xl border border-line [&_img]:object-contain" sizes="800px" />)}</div> : imageUrl ? <Img src={imageUrl} alt={`${name} brochure`} className="mx-auto aspect-[3/4] w-full max-w-3xl rounded-xl [&_img]:object-contain" sizes="800px" /> : url ? <div><button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink"><BookOpen size={17} />{open ? "Close brochure" : "Read brochure"}</button>{open && <iframe src={`${url.split("#")[0]}#toolbar=0&navpanes=0&view=FitH`} title={`${name} brochure reader`} referrerPolicy="no-referrer" className="mt-4 h-[70dvh] min-h-80 w-full rounded-2xl border border-line bg-paper" />}</div> : <article className="overflow-hidden rounded-2xl border border-line bg-paper sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"><Img src={image} alt={name} className="h-52 w-full sm:h-full" sizes="600px" /><div className="p-5 sm:p-7"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent"><FileText size={15} />Project brief</p><h3 className="mt-3 text-3xl font-semibold tracking-tight">{name}</h3><p className="mt-2 text-sm text-muted">By {builder}</p><p className="mt-4 text-[16px] leading-relaxed text-muted">{description}</p><div className="mt-5 flex flex-wrap gap-2">{configurations.map(configuration => <span key={configuration} className="rounded-full border border-line bg-raised px-3 py-1.5 text-sm font-medium">{configuration}</span>)}</div><p className="mt-5 text-xs leading-relaxed text-muted">From the project listing. The builder’s brochure has not been supplied.</p></div></article>}
  </div>;
}
