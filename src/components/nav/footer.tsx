"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/nav/logo";
import { useCustomer } from "@/components/auth/auth-provider";

const LINKS = [
  ["/search?type=buy", "Buy"], ["/search?type=rent", "Rent"], ["/projects", "Projects"],
  ["/localities", "Localities"], ["/insights", "Insights"], ["/sell", "Sell"], ["/about", "About & policies"],
];

export function Footer() {
  const { production } = useCustomer();
  const pathname = usePathname();
  if (pathname === "/search") return null;

  return (
    <footer className="border-t border-line bg-raised px-5 pb-20 pt-5 md:px-8 md:pb-5">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
          <Logo size="sm" />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {LINKS.map(([href, label]) => (
              <Link key={href} href={href} className="py-1 hover:text-ink hover:underline">{label}</Link>
            ))}
          </nav>
        </div>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2 text-[11px] text-muted">
          <span>© {new Date().getFullYear()} PropIT Technologies</span>
          <span>{production ? "Property information is supplied by listing owners. Verify RERA, availability and title independently." : "Preview inventory and modelled prices. These are not live listings."}</span>
          <span>Map data © OpenStreetMap contributors</span>
        </p>
      </div>
    </footer>
  );
}
