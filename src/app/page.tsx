import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { allLocalities, allProjects, featuredProjects, queryProperties } from "@/lib/data/repository";
import { formatCount, formatPrice, formatPriceSqft, projectStatusLabel } from "@/lib/format";
import { Hero } from "@/components/home/hero";
import { Img } from "@/components/ui/img";
import styles from "@/components/home/hero.module.css";

const PRIME_LOCALITIES = ["gachibowli", "kokapet", "madhapur", "jubilee-hills", "banjara-hills", "financial-district"];

export default function HomePage() {
  const inventory = allLocalities();
  const bySlug = new Map(inventory.map((locality) => [locality.slug, locality]));
  const byId = new Map(inventory.map((locality) => [locality.id, locality]));
  const localities = inventory.map(({ slug, name, center, boundary, avgPriceSqft }) => ({
    slug, name, center, boundary, avgPriceSqft,
  }));
  const { total, items, points, contextPoints, localityCounts } = queryProperties({ limit: 3 });
  const mapProjects = allProjects().map(({ id, slug, name, localityId, location, priceMin }) => ({
    id, slug, name, localityId, lat: location.lat, lng: location.lng, priceMin,
  }));

  const prime = (
    <section key="prime-localities" className={styles.catalogue} aria-labelledby="prime-title">
      <div className={styles.sectionHeader}>
        <h2 id="prime-title">Prime localities in Hyderabad</h2>
        <Link className={styles.textLink} href="/localities">All localities <ArrowUpRight size={15} /></Link>
      </div>
      <ul className={styles.localityRail}>
        {PRIME_LOCALITIES.map((slug) => {
          const locality = bySlug.get(slug);
          if (!locality) return null;
          return (
            <li key={slug}>
              <Link className={styles.localityCard} href={`/search?type=buy&locality=${slug}`}>
                <Img src={locality.heroImage} alt="" className={styles.tileImage} sizes="(max-width: 640px) 70vw, 250px" />
                <div className={styles.localityInfo}>
                  <h3>{locality.name}</h3>
                  <p>{formatPriceSqft(locality.avgPriceSqft)} <span>· {formatCount(locality.inventoryCount)} listings</span></p>
                </div>
                <ArrowUpRight aria-hidden="true" size={17} className={styles.tileArrow} />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );

  const projects = (
    <section key="projects" className={styles.catalogue} aria-labelledby="projects-title">
      <div className={styles.sectionHeader}>
        <h2 id="projects-title">Projects in Hyderabad</h2>
        <Link className={styles.textLink} href="/projects">All projects <ArrowUpRight size={15} /></Link>
      </div>
      <ul className={styles.projectRail}>
        {featuredProjects(4).map((project) => (
          <li key={project.id}>
            <Link className={styles.projectCard} href={`/project/${project.slug}`}>
              <Img src={project.heroImage} alt="" className={styles.projectImage} sizes="(max-width: 640px) 76vw, 360px" />
              <div className={styles.projectInfo}>
                <p>{byId.get(project.localityId)?.name ?? "Hyderabad"} · {projectStatusLabel(project.status)}</p>
                <h3>{project.name}</h3>
                <div><strong>From {formatPrice(project.priceMin)}</strong><ArrowUpRight aria-hidden="true" size={16} /></div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <main>
      <Hero localities={localities} mapProjects={mapProjects} initialResults={{ total, items, points, contextPoints, localityCounts }}
        prime={prime} projects={projects} />
    </main>
  );
}
