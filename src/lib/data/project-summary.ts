import type { Project } from "@/types";

export type ProjectSummary = Pick<Project, "id" | "slug" | "name" | "heroImage" | "priceMin" | "status"> & { localityName: string; developerName: string };
