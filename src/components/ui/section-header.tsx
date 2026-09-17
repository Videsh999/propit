import { LinkArrow } from "@/components/ui/skiper-ui/skiper40";

export function SectionHeader({
  eyebrow, title, lead, href, hrefLabel,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-[52ch]">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 className="display text-[32px] leading-[1.06] text-ink md:text-[40px]">{title}</h2>
        {lead && <p className="mt-3 text-[15px] leading-relaxed text-muted">{lead}</p>}
      </div>
      {href && (
        <LinkArrow href={href} className="whitespace-nowrap text-[15px] text-ink hover:text-accent">
          {hrefLabel ?? "View all"}
        </LinkArrow>
      )}
    </header>
  );
}
