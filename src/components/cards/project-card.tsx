import Link from "next/link";
import { Img } from "@/components/ui/img";
import { QualityBadge, Tag } from "@/components/ui/badge";
import { formatPrice, projectStatusLabel } from "@/lib/format";
import type { Project } from "@/types";

export function ProjectCard({
  project, developerName, localityName, size = "md",
}: {
  project: Project;
  developerName: string;
  localityName: string;
  size?: "md" | "lg";
}) {
  return (
    <Link href={`/project/${project.slug}`} className="group block">
      <Img
        src={project.heroImage}
        alt={project.name}
        seed={project.id}
        className={`w-full rounded-[var(--r-md)] ${size === "lg" ? "aspect-[4/3]" : "aspect-[16/11]"}`}
        sizes="(max-width: 768px) 100vw, 33vw"
      />
      <div className="mt-3.5">
        <div className="flex items-center gap-2">
          <Tag>{projectStatusLabel(project.status)}</Tag>
          {project.reraVerified && <QualityBadge quality="verified" label="RERA" />}
        </div>
        <h3 className="mt-2 text-[17px] font-medium leading-snug text-ink transition-colors group-hover:text-accent">
          {project.name}
        </h3>
        <p className="mt-0.5 text-[13px] text-muted">
          {developerName} · {localityName}
        </p>
        <p className="tnum mt-2 text-[14px] text-ink">
          From <span className="font-semibold">{formatPrice(project.priceMin)}</span>
          <span className="text-faint"> · {project.configurations.join(", ")}</span>
        </p>
        <p className="tnum mt-0.5 text-[12px] text-faint">Possession {project.possessionDate}</p>
      </div>
    </Link>
  );
}
