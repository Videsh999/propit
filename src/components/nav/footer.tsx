"use client";

import { usePathname } from "next/navigation";
import { Link000 } from "@/components/ui/skiper-ui/skiper40";
import { Logo } from "@/components/nav/logo";

/**
 * Three short columns, not five long ones.
 *
 * A footer's job here is to be a quiet index of the product, and the previous
 * version listed the same destinations two and three times over — "Buy" under
 * Discover, "Locality reports" under Intelligence pointing at the same page as
 * "Localities". Every entry below goes somewhere different.
 */
const COLUMNS = [
  {
    title: "Discover",
    links: [
      { href: "/search?type=buy", label: "Buy" },
      { href: "/search?type=rent", label: "Rent" },
      { href: "/projects", label: "Projects" },
      { href: "/localities", label: "Localities" },
      { href: "/insights", label: "Insights" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/sell", label: "Sell with PropIT" },
      { href: "/about", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/about", label: "Privacy" },
      { href: "/about", label: "Terms" },
      { href: "/about", label: "Data & honesty" },
    ],
  },
];

export function Footer() {
  const pathname = usePathname();
  // The map view is a full-height application surface — a footer under it would
  // create a scroll the map itself is meant to own.
  if (pathname === "/search") return null;

  return (
    <footer className="border-t border-line px-5 py-10 md:px-8">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid gap-10 md:grid-cols-[1.6fr_repeat(3,1fr)]">
          <div>
            <Logo size="lg" href={null} />
            <p className="eyebrow mt-3 text-[10px]">Properties. People. Possibilities.</p>
            <p className="mt-3 max-w-[38ch] text-[13px] leading-relaxed text-muted">
              Map-first property discovery for Hyderabad. Listings, projects and locality figures
              shown here are development data, not live market inventory.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="eyebrow mb-3">{col.title}</h3>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link000 href={l.href} className="inline-flex text-[13px] text-muted transition-colors hover:text-ink">
                      {l.label}
                    </Link000>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-line pt-5">
          <p className="max-w-[72ch] text-[11px] leading-relaxed text-faint">
            PropIT is in development. Listings, projects and locality figures are development data,
            not live market inventory, and pricing is modelled rather than recorded. Nothing here is
            financial or legal advice — verify RERA registration and title independently.
          </p>
          <p className="mt-3 flex flex-wrap gap-x-2 text-[11px] text-faint">
            <span>© {new Date().getFullYear()} PropIT Technologies · Hyderabad</span>
            <span aria-hidden>·</span>
            <span>Basemap © OpenStreetMap contributors · ORR from OSM relation 5634923</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
