import { prepareStore } from "@/lib/data/store";
import type { Metadata } from "next";
import { allProjects, featuredProjects, getDeveloper, getLocality } from "@/lib/data/repository";
import { ProjectIndex, type IndexProject } from "@/components/project/project-index";

export const metadata: Metadata = {
  title: "New projects in Hyderabad",
  description:
    "New launches, under-construction and ready-to-move projects across Hyderabad, with developers, configurations and RERA status.",
};

export default async function ProjectsPage() {
  await prepareStore();
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
    <main className="mx-auto max-w-[1440px] px-5 py-7 md:px-8 md:py-10">
      <header className="mb-8 max-w-[70ch]">
        <p className="eyebrow mb-3">Projects · {projects.length} tracked</p>
        <h1 className="display text-[42px] leading-[1.02] text-ink md:text-[58px]">
          Projects in Hyderabad.
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-muted">
          Filter by locality, budget and configuration. Compare the details side by side.
        </p>
      </header>

      <ProjectIndex projects={projects} leadIds={leads} />
    </main>
  );
}
