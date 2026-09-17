import type { Metadata } from "next";
import { allProjects, featuredProjects, getDeveloper, getLocality } from "@/lib/data/repository";
import { ProjectIndex, type IndexProject } from "@/components/project/project-index";

export const metadata: Metadata = {
  title: "New projects in Hyderabad",
  description:
    "New launches, under-construction and ready-to-move projects across Hyderabad, with developers, configurations and RERA status.",
};

export default function ProjectsPage() {
  const projects: IndexProject[] = allProjects().map((p) => {
    const locality = getLocality(p.localityId);
    return {
      ...p,
      developerName: getDeveloper(p.developerId)?.name ?? "Developer",
      localityName: locality?.name ?? "",
      localitySlug: locality?.slug ?? "",
    };
  });

  // Same curation as the homepage showcase: distinct localities, distinct
  // photographs. Three identical-looking villas at the top of the index was the
  // first thing the eye landed on.
  const leads = featuredProjects(3).map((p) => p.id);

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-16 md:px-8 md:py-20">
      <header className="max-w-[58ch]">
        <p className="eyebrow mb-3">Projects · {projects.length} tracked</p>
        <h1 className="display text-[42px] leading-[1.02] text-ink md:text-[58px]">
          Every development, one map.
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-muted">
          New launches, sites under construction and buildings with keys in hand — each one still
          attached to the ground it sits on.
        </p>
      </header>

      <div className="mt-20 md:mt-28">
        <ProjectIndex projects={projects} leadIds={leads} />
      </div>
    </main>
  );
}
