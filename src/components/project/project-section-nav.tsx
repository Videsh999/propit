"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export function ProjectSectionNav({ name, sections }: { name: string; sections: string[][] }) {
  const [active, setActive] = useState(sections[0]?.[0]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => { const target = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (target) setActive(target.target.id); }, { root: document.body, rootMargin: "-165px 0px -55% 0px", threshold: 0 });
    for (const [id] of sections) { const section = document.getElementById(id); if (section) observer.observe(section); }
    return () => observer.disconnect();
  }, [sections]);
  return <nav aria-label="Project sections" className="sticky top-20 z-30 my-6 min-w-0 rounded-2xl border border-line bg-raised/95 p-2 shadow-e2 backdrop-blur-xl md:flex md:items-center md:gap-3 md:rounded-full">
    <Link href="#media" className="block max-w-full truncate px-3 py-1 text-sm font-semibold text-ink md:max-w-48 md:shrink-0 md:border-r md:border-line">{name}</Link>
    <div className="flex min-w-0 gap-1 overflow-x-auto">{sections.map(([id, label]) => <Link key={id} href={`#${id}`} onClick={() => setActive(id)} aria-current={active === id ? "location" : undefined} className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-[14px] font-medium text-muted transition-colors hover:bg-paper aria-[current=location]:bg-accent-wash aria-[current=location]:text-accent">{label}</Link>)}</div>
  </nav>;
}
