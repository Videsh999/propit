import type { Developer } from "@/types";
import { slugify } from "@/lib/utils";

interface DevSeed {
  name: string;
  est: number;
  delivered: number;
  about: string;
}

const SEEDS: DevSeed[] = [
  { name: "Aurum Estates", est: 1998, delivered: 42, about: "Aurum builds large-format gated communities across the western corridor, known for clubhouse-led amenity programmes and consistent on-time possession." },
  { name: "Meridian Habitat", est: 2004, delivered: 31, about: "A design-led developer working with international architects on mid-rise and low-density projects in central Hyderabad." },
  { name: "Sanctum Developers", est: 1991, delivered: 68, about: "One of the city's oldest residential builders, with a large delivered portfolio in the north-west and a strong resale reputation." },
  { name: "Verdant Realty", est: 2011, delivered: 18, about: "Focused on sustainability — IGBC-rated towers, rainwater systems and native landscaping across the ORR growth belt." },
  { name: "Kalyan Group", est: 1987, delivered: 91, about: "A volume developer with deep land holdings in the north and east, serving the mid-market with dependable, no-frills product." },
  { name: "Ivory Constructions", est: 2007, delivered: 27, about: "Premium apartments and penthouses in Jubilee Hills and Banjara Hills, with a boutique, low-inventory approach." },
  { name: "Nirvana Spaces", est: 2014, delivered: 12, about: "A younger developer building amenity-heavy townships in Tellapur and Kollur aimed at first-time premium buyers." },
  { name: "Prasadam Infra", est: 1996, delivered: 55, about: "Known for villa communities and plotted developments across the southern and northern peripheries." },
  { name: "Skyline Ventures", est: 2002, delivered: 38, about: "High-rise specialists — the tallest residential towers in the Financial District belt carry their name." },
  { name: "Anantam Builders", est: 2009, delivered: 22, about: "Mid-premium apartments with a focus on efficient layouts and low common-area loading." },
  { name: "Coastal Crest Homes", est: 2016, delivered: 9, about: "New-generation developer working on compact luxury near the IT core, with strong interior specifications." },
  { name: "Rathnam Estates", est: 1993, delivered: 61, about: "A trusted mid-market name in the east and south-east, with a large delivered rental portfolio." },
];

export const DEVELOPERS: Developer[] = SEEDS.map((s) => ({
  id: `dev_${slugify(s.name)}`,
  name: s.name,
  slug: slugify(s.name),
  establishedYear: s.est,
  projectsDelivered: s.delivered,
  reraRegistered: true,
  about: s.about,
  logoMark: s.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase(),
}));

export const DEVELOPER_BY_ID = new Map(DEVELOPERS.map((d) => [d.id, d]));
export const DEVELOPER_BY_SLUG = new Map(DEVELOPERS.map((d) => [d.slug, d]));

export const AMENITIES = [
  { slug: "pool", name: "Swimming Pool", category: "Recreation" },
  { slug: "gym", name: "Fitness Centre", category: "Recreation" },
  { slug: "clubhouse", name: "Clubhouse", category: "Recreation" },
  { slug: "security", name: "24×7 Security", category: "Safety" },
  { slug: "parking", name: "Covered Parking", category: "Convenience" },
  { slug: "garden", name: "Landscaped Garden", category: "Outdoor" },
  { slug: "power-backup", name: "Power Backup", category: "Utilities" },
  { slug: "ev-charging", name: "EV Charging", category: "Utilities" },
  { slug: "kids-play", name: "Children's Play Area", category: "Family" },
  { slug: "sports", name: "Sports Courts", category: "Recreation" },
  { slug: "jogging-track", name: "Jogging Track", category: "Outdoor" },
  { slug: "amphitheatre", name: "Amphitheatre", category: "Recreation" },
  { slug: "co-working", name: "Co-working Lounge", category: "Convenience" },
  { slug: "concierge", name: "Concierge Desk", category: "Convenience" },
  { slug: "rainwater", name: "Rainwater Harvesting", category: "Sustainability" },
  { slug: "stp", name: "Sewage Treatment Plant", category: "Sustainability" },
  { slug: "yoga-deck", name: "Yoga Deck", category: "Wellness" },
  { slug: "spa", name: "Spa & Sauna", category: "Wellness" },
  { slug: "pet-park", name: "Pet Park", category: "Family" },
  { slug: "indoor-games", name: "Indoor Games", category: "Recreation" },
] as const;

export const AMENITY_BY_SLUG = new Map(AMENITIES.map((a) => [a.slug, a]));
