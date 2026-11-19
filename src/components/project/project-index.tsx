"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ChevronDown, MapPin, SlidersHorizontal } from "lucide-react";
import { ProjectCard } from "@/components/cards/project-card";
import { LocalityFilter, type LocalityOption } from "@/components/filters/locality-filter";
import { Button } from "@/components/ui/button";
import { projectStatusLabel } from "@/lib/format";
import type { Project, ProjectStatus } from "@/types";
import { cn } from "@/lib/utils";
import styles from "@/components/browse/browse.module.css";

export interface IndexProject extends Project { developerName: string; localityName: string; localitySlug: string }
const STATUSES: ProjectStatus[] = ["new_launch", "under_construction", "ready", "upcoming"];
const INITIAL = { query: "", status: "", configuration: "", budget: "", locality: "", rera: false };

export function ProjectIndex({ projects, leadIds }: { projects: IndexProject[]; leadIds: string[] }) {
  const [filters, setFilters] = useState(INITIAL);
  const [sort, setSort] = useState("featured");
  const [shown, setShown] = useState(12);
  const [localityReset, setLocalityReset] = useState(0);
  const [mobileFilters, setMobileFilters] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);
  function showResults() {
    setMobileFilters(false);
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
  }
  function update(patch: Partial<typeof INITIAL>) { setFilters((current) => ({ ...current, ...patch })); setShown(12); }
  function reset() { setFilters(INITIAL); setShown(12); setLocalityReset((value) => value + 1); }
  const eligible = useMemo(() => {
    const term = filters.query.trim().toLowerCase();
    return projects.filter((project) =>
      (!term || `${project.name} ${project.developerName} ${project.localityName}`.toLowerCase().includes(term))
      && (!filters.status || project.status === filters.status)
      && (!filters.configuration || project.configurations.includes(filters.configuration))
      && (!filters.budget || project.priceMin <= Number(filters.budget))
      && (!filters.rera || project.reraVerified),
    );
  }, [projects, filters.query, filters.status, filters.configuration, filters.budget, filters.rera]);
  const localities = useMemo(() => {
    const bySlug = new Map<string, LocalityOption>();
    for (const project of projects) bySlug.set(project.localitySlug, { slug: project.localitySlug, name: project.localityName, count: 0 });
    for (const project of eligible) {
      const entry = bySlug.get(project.localitySlug)!;
      entry.count = (entry.count ?? 0) + 1;
    }
    return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, eligible]);
  const configurations = useMemo(() => [...new Set(projects.flatMap((project) => project.configurations))].sort(), [projects]);
  const matches = useMemo(() => {
    const ranks = new Map(leadIds.map((id, index) => [id, index]));
    return eligible.filter((project) => !filters.locality || project.localitySlug === filters.locality)
      .sort((a, b) => sort === "price_asc" ? a.priceMin - b.priceMin : sort === "price_desc" ? b.priceMin - a.priceMin
        : (ranks.get(a.id) ?? leadIds.length) - (ranks.get(b.id) ?? leadIds.length) || a.name.localeCompare(b.name));
  }, [eligible, leadIds, filters.locality, sort]);

  return (
    <>
      <div className={styles.toolbar}>
        <p role="status" className={styles.count}><strong>{matches.length}</strong> {matches.length === 1 ? "project" : "projects"}{filters.locality && ` in ${localities.find(({ slug }) => slug === filters.locality)?.name}`}</p>
        <div className={styles.toolbarActions}>
          <Button className={styles.mobileToggle} size="sm" onClick={() => setMobileFilters(!mobileFilters)} aria-expanded={mobileFilters} aria-controls="project-filters"><SlidersHorizontal size={14} /> Filters</Button>
          <div className={styles.sort}><select aria-label="Sort projects" value={sort} onChange={(event) => { setSort(event.target.value); setShown(12); }}>
            <option value="featured">Featured first</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option>
          </select><ChevronDown size={14} aria-hidden="true" /></div>
        </div>
      </div>
      <div className={styles.layout}>
        <aside id="project-filters" aria-label="Project filters" className={cn(styles.sidebar, mobileFilters && styles.sidebarOpen)}>
          <div className={styles.sidebarHeader}><h2>Filters</h2><button type="button" className={styles.reset} onClick={reset}>Reset all</button></div>
          <div className={styles.fields}>
            <label className={styles.field}><span>Project or developer</span><input type="search" aria-label="Search projects" placeholder="Search by name" value={filters.query} onChange={(event) => update({ query: event.target.value })} /></label>
            <label className={styles.field}><span>Project status</span><select aria-label="Project status" value={filters.status} onChange={(event) => update({ status: event.target.value })}><option value="">All statuses</option>{STATUSES.map((status) => <option key={status} value={status}>{projectStatusLabel(status)}</option>)}</select><ChevronDown size={13} aria-hidden="true" /></label>
            <label className={styles.field}><span>Configuration</span><select aria-label="Configuration" value={filters.configuration} onChange={(event) => update({ configuration: event.target.value })}><option value="">All configurations</option>{configurations.map((configuration) => <option key={configuration}>{configuration}</option>)}</select><ChevronDown size={13} aria-hidden="true" /></label>
            <label className={styles.field}><span>Starting budget</span><select aria-label="Starting budget" value={filters.budget} onChange={(event) => update({ budget: event.target.value })}><option value="">Any budget</option>{[1, 2, 3, 5].map((crore) => <option key={crore} value={crore * 1e7}>Up to ₹{crore} Cr</option>)}</select><ChevronDown size={13} aria-hidden="true" /></label>
            <label className={styles.check}><input type="checkbox" checked={filters.rera} onChange={(event) => update({ rera: event.target.checked })} /> RERA marked projects</label>
          </div>
          <div className={styles.localitySection}><LocalityFilter key={localityReset} items={localities} value={filters.locality} onChange={(locality) => update({ locality })} countLabel="projects" /></div>
          <Button variant="primary" className={cn(styles.mobileToggle, "mt-5 w-full")} onClick={showResults}>Show {matches.length} {matches.length === 1 ? "project" : "projects"}</Button>
        </aside>
        <section ref={resultsRef} aria-label="Project results" className={styles.results}>
          {matches.length ? <>
            <div className={styles.grid}>{matches.slice(0, shown).map((project) => (
              <article key={project.id} className={cn(styles.item, styles.projectItem)}>
                <ProjectCard project={project} developerName={project.developerName} localityName={project.localityName} showDetails />
                <div className={styles.itemFooter}><Link href={`/project/${project.slug}`}>Project details</Link><Link href={`/search?type=buy&locality=${project.localitySlug}`} aria-label={`View ${project.name} locality map`}><MapPin size={13} aria-hidden="true" /> Locality map</Link></div>
              </article>
            ))}</div>
            <p className={styles.notice}>Showing {Math.min(shown, matches.length)} of {matches.length} projects.</p>
            {shown < matches.length && <div className={styles.loadMore}><Button onClick={() => setShown(shown + 12)}>Show more projects</Button></div>}
          </> : <div className={styles.empty}><h2>No matching projects</h2><p>Try another locality, budget or project status.</p><Button onClick={reset}>Clear filters</Button></div>}
        </section>
      </div>
    </>
  );
}
