import Link from "next/link";
import { Building2 } from "lucide-react";
import { allDevelopers, allProjects } from "@/lib/data/repository";
import { prepareStore } from "@/lib/data/store";
export const metadata = { title: "Hyderabad property developers", description: "Explore developer profiles and their projects in Hyderabad." };
export default async function DevelopersPage() {
  await prepareStore(); const developers = allDevelopers(); const projects = allProjects();
  return <main className="mx-auto max-w-[1440px] px-5 py-9 sm:px-8"><p className="eyebrow">The people behind the places</p><h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Hyderabad’s developers.</h1><p className="mt-4 max-w-[58ch] text-[16px] leading-relaxed text-muted">Get to know the builders, their experience and the communities they create.</p><ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{developers.map(developer => <li key={developer.id}><Link href={`/developer/${developer.slug}`} className="block h-full rounded-3xl border border-line bg-raised p-6 transition-shadow hover:shadow-e2"><span className="grid size-14 place-items-center rounded-2xl bg-accent-wash text-lg font-semibold text-accent">{developer.logoMark}</span><h2 className="mt-4 text-xl font-semibold">{developer.name}</h2><p className="mt-2 text-sm text-muted">Established {developer.establishedYear} · {developer.projectsDelivered} delivered</p><p className="mt-4 line-clamp-3 text-[16px] leading-relaxed text-muted">{developer.about}</p><span className="mt-5 flex items-center gap-2 text-sm font-semibold text-accent"><Building2 size={16} />{projects.filter(project => project.developerId === developer.id).length} projects to explore</span></Link></li>)}</ul></main>;
}
