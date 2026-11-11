"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PropitMap } from "@/components/map/propit-map";
import { formatCount } from "@/lib/format";
import type { Locality, Property } from "@/types";

/**
 * The locality's own map.
 *
 * A locality page that only shows photographs makes the reader guess where the
 * place is. This puts the boundary, the homes and their prices on screen, and
 * hands the whole thing to the main map when they want to go further — so the
 * page and the map remain one system rather than two.
 */
export function LocalityMap({
  locality,
  properties,
}: {
  locality: Locality;
  properties: Pick<Property, "id" | "location" | "price" | "bedrooms" | "propertyType">[];
}) {
  const points = useMemo(
    () =>
      properties.map((p) => ({
        id: p.id,
        lat: p.location.lat,
        lng: p.location.lng,
        price: p.price,
        bedrooms: p.bedrooms,
        type: p.propertyType,
      })),
    [properties],
  );

  const localities = useMemo(
    () => [
      {
        slug: locality.slug,
        name: locality.name,
        center: locality.center,
        boundary: locality.boundary,
        avgPriceSqft: locality.avgPriceSqft,
      },
    ],
    [locality],
  );

  return (
    <section className="mt-14">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="display text-[28px] text-ink">{locality.name} on the map</h2>
        <Link
          href={`/search?type=buy&locality=${locality.slug}`}
          className="border-b border-[var(--line-strong)] pb-0.5 text-[14px] text-ink transition-colors hover:border-[var(--accent)] hover:text-accent"
        >
          Search {formatCount(properties.length)} homes here →
        </Link>
      </div>
      <div
        className="overflow-hidden rounded-[var(--r-lg)] border border-line shadow-[var(--e1)]"
        style={{ height: 420 }}
      >
        <PropitMap key={locality.slug} compact localityScope={locality} followDiscoveryCamera={false} points={points} localities={localities} />
      </div>
      <p className="mt-2.5 text-[12px] text-faint">
        Browse the mapped listings in this locality.
      </p>
    </section>
  );
}
