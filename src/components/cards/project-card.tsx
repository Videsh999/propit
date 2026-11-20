import Link from "next/link";
import { Img } from "@/components/ui/img";
import { QualityBadge, Tag } from "@/components/ui/badge";
import { formatPrice, projectStatusLabel } from "@/lib/format";
import type { Project } from "@/types";

export function ProjectCard({
  project, developerName, localityName, size = "md", showDetails = false,
}: {
  project: Project;
  developerName: string;
  localityName: string;
  size?: "md" | "lg";
  showDetails?: boolean;
}) {
  return (
    <Link href={`/project/${project.slug}`} className="group block overflow-hidden rounded-[var(--r-lg)] border border-line bg-raised p-2.5 shadow-e1 transition-shadow hover:shadow-e2">
      <Img
        src={project.heroImage}
        alt={project.name}
        seed={project.id}
        className={`w-full rounded-[var(--r-md)] ${size === "lg" ? "aspect-[4/3]" : "aspect-[16/11]"}`}
        sizes="(max-width: 768px) 100vw, 33vw"
      />
      <div className="px-2 pb-3 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Tag>{projectStatusLabel(project.status)}</Tag>
          {project.profile?.type && <Tag>{project.profile.type}</Tag>}
          {project.profile?.category && <Tag>{project.profile.category}</Tag>}
          {project.reraVerified && <QualityBadge quality="verified" label="RERA" />}
        </div>
        <h3 className="mt-3 font-[family-name:var(--font-editorial)] text-[28px] font-normal leading-tight tracking-tight text-ink transition-colors group-hover:text-accent">
          {project.name}
        </h3>
        <p className="mt-0.5 text-[13px] text-muted">
          {developerName} · {localityName}
        </p>
        <p className="tnum mt-2 text-[14px] text-ink">
          From <span className="font-semibold">{formatPrice(project.priceMin)}</span>
          <span className="text-faint"> · {project.configurations.join(", ")}</span>
        </p>
        <p className="tnum mt-1.5 text-[12px] text-faint">Possession {project.possessionDate} · {project.landAreaAcres} acres</p>
        {showDetails && <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 text-xs">
          <div><dt className="text-muted">Total units</dt><dd className="mt-1 font-semibold">{project.unitsTotal.toLocaleString("en-IN")}</dd></div>
          <div><dt className="text-muted">Towers · floors</dt><dd className="mt-1 font-semibold">{project.towers} · {project.floors}</dd></div>
        </dl>}
      </div>
    </Link>
  );
}
