"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Search, Scale, User, Menu, X } from "lucide-react";
import { Logo } from "@/components/nav/logo";
import { cn } from "@/lib/utils";
import { useDiscovery } from "@/store/discovery";
import { Link000 } from "@/components/ui/skiper-ui/skiper40";

const LINKS = [
  { href: "/search?type=buy", label: "Buy", match: "/search" },
  { href: "/search?type=rent", label: "Rent" },
  { href: "/projects", label: "Projects" },
  { href: "/localities", label: "Localities" },
  { href: "/insights", label: "Insights" },
];

export function Navbar() {
  const pathname = usePathname();
  const compareCount = useDiscovery((state) => state.compareIds.length);
  const [mobileOpen, setMobileOpen] = useState(false);
  const setPaletteOpen = useDiscovery((s) => s.setPaletteOpen);


  return (
    <header
      className={cn(
        "sticky top-0 z-50 h-[72px] w-full border-b border-line",
        "bg-paper text-ink",
      )}
    >
      <nav className="mx-auto flex h-full max-w-[1440px] items-center gap-3 px-4 sm:px-5 lg:gap-7 lg:px-8">
        <Logo size="md" />

        <ul className="hidden flex-1 items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = pathname === l.href.split("?")[0] && pathname !== "/";
            return (
              <li key={l.label} className="px-2 py-2 lg:px-3">
                <Link000
                  href={l.href}
                  className={cn(
                    "text-[14px] transition-colors duration-[160ms]",
                    active ? "text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  {l.label}
                </Link000>
              </li>
            );
          })}
        </ul>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden h-9 items-center gap-2 rounded-full border border-line bg-raised pl-3 pr-2 text-[13px] text-faint transition-colors hover:border-line-strong hover:text-muted lg:flex"
            aria-label="Search PropIT"
          >
            <Search size={14} strokeWidth={1.75} />
            <span>Search</span>
            <kbd className="ml-2 rounded border border-line bg-sunk px-1.5 py-0.5 font-sans text-[10px] text-faint">
              ⌘K
            </kbd>
          </button>

          <Link href="/compare" aria-current={pathname === "/compare" ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-2.5 text-sm font-semibold hover:border-line-strong",
              compareCount > 0 || pathname === "/compare" ? "bg-accent-wash text-accent" : "bg-raised text-muted",
            )}
            aria-label={`Open comparison, ${compareCount} selected`}>
            <Scale size={15} aria-hidden="true" />
            <span className="hidden xl:inline">Compare</span>
            {compareCount > 0 && <span>{compareCount}</span>}
          </Link>

          <Link
            href="/profile"
            className="grid h-9 w-9 place-items-center rounded-full border border-line bg-raised text-muted transition-colors hover:border-line-strong hover:text-ink"
            aria-label="Your profile"
          >
            <User size={15} strokeWidth={1.75} />
          </Link>

          <button
            className="grid h-9 w-9 place-items-center rounded-[var(--r-sm)] text-muted md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="border-t border-line bg-paper px-5 py-3 md:hidden">
          <ul className="grid gap-1">
            {LINKS.map((l) => (
              <li key={l.label}>
                <Link
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="block py-2.5 text-[15px] text-ink"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
