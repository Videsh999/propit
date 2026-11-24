"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ImageIcon, MapPin, Play } from "lucide-react";
import { Img } from "@/components/ui/img";
import { uniqueProjectPhotos } from "@/lib/data/project-presentation";

export function ProjectGallery({ name, images, videoUrl, preview }: { name: string; images: string[]; videoUrl?: string; preview: boolean }) {
  const photos = uniqueProjectPhotos(images);
  const [index, setIndex] = useState(0);
  const [video, setVideo] = useState(false);
  const active = Math.min(index, Math.max(0, photos.length - 1));
  function advance(direction: number) { setVideo(false); setIndex((active + direction + photos.length) % photos.length); }

  return <div aria-label="Project gallery" role="group" className="min-w-0" onKeyDown={event => {
    if (!video && photos.length > 1 && ["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); advance(event.key === "ArrowRight" ? 1 : -1); }
  }}>
    <div className="relative overflow-hidden rounded-[24px] border border-line bg-sunk">
      {video && videoUrl ? <video key={videoUrl} src={videoUrl} controls preload="metadata" poster={photos[0]} className="aspect-[5/4] w-full object-contain" aria-label={`${name} video tour`} />
        : photos.length ? <Img key={photos[active]} src={photos[active]} alt={`${name} · photo ${active + 1}`} className="aspect-[5/4] w-full" priority sizes="(max-width: 1023px) 100vw, 50vw" />
          : <div className="grid aspect-[5/4] place-items-center text-muted">Project photos not supplied.</div>}
      <Link href="#location" className="absolute right-3 top-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-raised/95 px-4 text-[14px] font-semibold text-accent shadow-e1 backdrop-blur"><MapPin size={16} />View on map</Link>
      {!video && photos.length > 1 && <>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />
        <span className="absolute bottom-5 left-4 flex items-center gap-2 text-[14px] font-medium text-white" aria-live="polite"><ImageIcon size={16} />{active + 1} / {photos.length}</span>
        <div className="absolute bottom-3 right-3 flex gap-2">
          <button type="button" aria-label="Previous project photo" onClick={() => advance(-1)} className="grid size-11 place-items-center rounded-full bg-raised/95 text-ink backdrop-blur hover:bg-raised"><ChevronLeft size={20} /></button>
          <button type="button" aria-label="Next project photo" onClick={() => advance(1)} className="grid size-11 place-items-center rounded-full bg-raised/95 text-ink backdrop-blur hover:bg-raised"><ChevronRight size={20} /></button>
        </div>
      </>}
    </div>
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Project photos">
      {photos.map((photo, i) => <button key={photo} type="button" aria-label={`View project photo ${i + 1}`} aria-pressed={!video && active === i} onClick={() => { setVideo(false); setIndex(i); }} className="w-[calc((100%-2rem)/5)] min-w-16 max-w-28 shrink-0 overflow-hidden rounded-xl border-2 border-transparent p-0.5 transition-colors aria-pressed:border-accent">
        <Img src={photo} alt="" className="aspect-[4/3] rounded-lg" sizes="120px" />
      </button>)}
      {videoUrl && <button type="button" onClick={() => setVideo(true)} aria-pressed={video} className="grid min-w-20 shrink-0 place-items-center gap-1 rounded-xl border border-line bg-raised p-3 text-[14px] text-accent aria-pressed:border-accent"><Play size={20} />Video</button>}
    </div>
    {preview && <p className="mt-2 text-xs text-muted">Preview photographs are illustrative.</p>}
  </div>;
}
