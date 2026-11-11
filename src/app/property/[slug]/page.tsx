import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPropertyBySlug, getLocality, getDeveloper, similarProperties, nearbyPlaces,
} from "@/lib/data/repository";
import { getStore } from "@/lib/data/store";
import { PropertyDetail } from "@/components/property/property-detail";
import { formatArea, formatPrice, propertyTypeLabel } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const property = getPropertyBySlug(slug);
  if (!property) return { title: "Home not found" };
  const locality = getLocality(property.localityId);
  const title = `${property.title} · ${locality?.name ?? "Hyderabad"}`;
  const description = `${propertyTypeLabel(property.propertyType)} in ${
    locality?.name ?? "Hyderabad"
  } — ${formatPrice(property.price)}, ${formatArea(property.builtupAreaSqft)}${
    property.bedrooms ? `, ${property.bedrooms} BHK` : ""
  }.`;
  return {
    title,
    description,
    openGraph: { title, description, images: property.images[0]?.url ? [property.images[0].url] : [] },
    alternates: { canonical: `/property/${property.slug}` },
  };
}

export default async function PropertyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const property = getPropertyBySlug(slug);
  if (!property) notFound();

  const store = getStore();
  const locality = getLocality(property.localityId)!;
  const project = property.projectId ? (store.projectById.get(property.projectId) ?? null) : null;
  const developer = project ? getDeveloper(project.developerId) : null;
  const similar = similarProperties(property, 4).map((s) => ({
    ...s,
    localityName: getLocality(s.localityId)?.name ?? "",
  }));

  return (
    <main>
      <PropertyDetail
        key={property.id}
        property={property}
        locality={locality}
        project={project}
        developer={developer}
        similar={similar}
        nearby={nearbyPlaces(property.location, null, 7, 3)}
      />
    </main>
  );
}
