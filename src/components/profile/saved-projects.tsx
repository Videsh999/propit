"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { useDiscovery } from "@/store/discovery";
import { Img } from "@/components/ui/img";
import { formatPrice, projectStatusLabel } from "@/lib/format";
import type { ProjectSummary } from "@/lib/data/project-summary";

export function SavedProjects() {
  const ids = useDiscovery(state => state.savedProjectIds);
  const toggle = useDiscovery(state => state.toggleSavedProject);
  const query = useQuery<{ items: ProjectSummary[] }>({
    queryKey: ["saved-projects", ids.join(",")], enabled: ids.length > 0, staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/projects/by-id?${new URLSearchParams({ ids: ids.join(",") })}`, { signal });
      if (!response.ok) throw new Error("Projects could not be loaded.");
      return response.json();
    },
  });
  if (!ids.length) return <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">Save a project from its page to keep it here.</p>;
  if (query.isPending) return <p role="status" className="text-sm text-muted">Loading your saved projects…</p>;
  if (query.isError) return <p role="alert" className="text-sm text-muted">We couldn’t load your projects. <button onClick={() => void query.refetch()} className="min-h-11 font-semibold text-accent">Try again</button></p>;
  if (!query.data.items.length) return <p role="status" className="rounded-2xl border border-line p-6 text-sm text-muted">Your saved projects are currently unavailable. You can browse more projects and save another.</p>;
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{query.data.items.map(project => <article key={project.id} className="relative overflow-hidden rounded-2xl border border-line bg-raised">
    <Link href={`/project/${project.slug}`}><Img src={project.heroImage} alt={project.name} className="aspect-[16/10] w-full" sizes="400px" /><div className="p-4"><p className="text-xs text-muted">{project.localityName} · {projectStatusLabel(project.status)}</p><h2 className="display mt-2 text-[27px]">{project.name}</h2><p className="mt-2 text-sm font-semibold">From {formatPrice(project.priceMin)}</p></div></Link>
    <button type="button" aria-label={`Unsave ${project.name}`} onClick={() => toggle(project.id)} className="absolute right-3 top-3 grid min-h-11 min-w-11 place-items-center rounded-full bg-raised text-accent shadow-e1"><Heart size={17} fill="currentColor" /></button>
  </article>)}</div>;
}
