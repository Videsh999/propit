"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, Sparkles, User, Menu, X } from "lucide-react";
import { Logo } from "@/components/nav/logo";
import { cn } from "@/lib/utils";
import { useDiscovery } from "@/store/discovery";
import { Button } from "@/components/ui/button";
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
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const setPaletteOpen = useDiscovery((s) => s.setPaletteOpen);
  const setAssistantOpen = useDiscovery((s) => s.setAssistantOpen);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full",
        "transition-[height,background-color,border-color,backdrop-filter] duration-[320ms] [transition-timing-function:var(--ease)]",
        scrolled
          ? "h-14 border-b border-line bg-[color-mix(in_srgb,var(--paper)_82%,transparent)] backdrop-blur-xl backdrop-saturate-150"
          : "h-[72px] border-b border-transparent bg-paper",
      )}
    >
      <nav className="mx-auto flex h-full max-w-[1440px] items-center gap-8 px-5 md:px-8">
        <Logo size="md" />

        <ul className="hidden flex-1 items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = pathname === l.href.split("?")[0] && pathname !== "/";
            return (
              <li key={l.label} className="px-3 py-2">
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

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setAssistantOpen(true)}
          >
            <Sparkles size={14} strokeWidth={1.75} />
            <span className="hidden sm:inline">Ask PropIT</span>
          </Button>

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
