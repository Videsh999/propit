import type { City, Locality } from "@/types";
import { mulberry32, hashString, slugify } from "@/lib/utils";

export const HYDERABAD: City = {
  id: "city_hyd",
  name: "Hyderabad",
  slug: "hyderabad",
  center: { lat: 17.4275, lng: 78.4},
  bounds: { west: 78.18, south: 17.18, east: 78.68, north: 17.66 },
};

const IMG = (id: string) => `https://images.unsplash.com/${id}?w=1400&q=80&auto=format&fit=crop`;

interface Seed {
  name: string;
  lat: number;
  lng: number;
  corridor: string;
  character: string;
  summary: string;
  priceSqft: number;
  radiusKm: number;
  yieldPct: number;
  momentum: number;
  image: string;
}

/** Real coordinates, real corridors, realistic 2026 price bands (₹ per sq.ft). */
const SEEDS: Seed[] = [
  { name: "Kokapet", lat: 17.4085, lng: 78.3283, corridor: "West · ORR Growth Belt", character: "Glass towers and new luxury inventory, minutes from the Financial District", summary: "Kokapet has become Hyderabad's highest-velocity luxury corridor. Neopolis land parcels pushed premium developers here, and the ORR interchange puts the Financial District within ten minutes. Inventory skews large — 3 and 4 BHK, high floors, clubhouse-led.", priceSqft: 11500, radiusKm: 2.3, yieldPct: 2.9, momentum: 14.2, image: IMG("photo-1486406146926-c627a92ad1ab") },
  { name: "Financial District", lat: 17.4155, lng: 78.341, corridor: "West · ORR Growth Belt", character: "Hyderabad's financial spine — weekday energy, weekend quiet", summary: "Home to global banking and consulting campuses. Residential supply is deliberately premium and walk-to-work. Strong rental demand from senior professionals, low weekend footfall.", priceSqft: 10800, radiusKm: 2.1, yieldPct: 3.4, momentum: 11.8, image: IMG("photo-1545324418-cc1a3fa10c00") },
  { name: "Nanakramguda", lat: 17.42, lng: 78.345, corridor: "West · ORR Growth Belt", character: "Campus-adjacent, dense, extremely well connected", summary: "Wedged between the Financial District and Gachibowli. Mature infrastructure, heavy office density, and the shortest commutes in the west.", priceSqft: 10200, radiusKm: 1.7, yieldPct: 3.6, momentum: 9.4, image: IMG("photo-1449824913935-59a10b8d2000") },
  { name: "Gachibowli", lat: 17.4401, lng: 78.3489, corridor: "West · IT Core", character: "The original IT address — schools, stadiums, hospitals, everything", summary: "The most complete western neighbourhood. International schools, AIG and Continental hospitals, the stadium, and a deep rental market. Prices are steady rather than explosive.", priceSqft: 8900, radiusKm: 2.6, yieldPct: 3.8, momentum: 7.1, image: IMG("photo-1560185007-cde436f6a4d0") },
  { name: "Madhapur", lat: 17.4485, lng: 78.3908, corridor: "West · IT Core", character: "Restaurants, nightlife, and the shortest walk to work in the city", summary: "Dense, walkable and permanently busy. Older inventory alongside new premium towers. Highest rental yields in the western belt.", priceSqft: 9800, radiusKm: 1.9, yieldPct: 4.1, momentum: 6.8, image: IMG("photo-1567496898669-ee935f5f647a") },
  { name: "Hitech City", lat: 17.4483, lng: 78.3915, corridor: "West · IT Core", character: "The centre of gravity for Hyderabad's technology economy", summary: "Metro-connected, saturated with offices, and the reference point most buyers measure every other locality against. Limited new land, so supply arrives as redevelopment.", priceSqft: 10500, radiusKm: 1.8, yieldPct: 3.9, momentum: 8.2, image: IMG("photo-1513584684374-8bab748fbf90") },
  { name: "Kondapur", lat: 17.4615, lng: 78.364, corridor: "West · IT Core", character: "Family-first, school-dense, quietly excellent value", summary: "Chirec, Sancta Maria and Botanical Garden anchor a genuinely family-oriented pocket. Wide roads, mature trees, and better value per sq.ft than Madhapur next door.", priceSqft: 7800, radiusKm: 2.4, yieldPct: 4.0, momentum: 6.2, image: IMG("photo-1570129477492-45c003edd2be") },
  { name: "Nallagandla", lat: 17.4737, lng: 78.3092, corridor: "West · Emerging", character: "Gated communities, lake air, and a fifteen-minute office run", summary: "Large gated townships with real amenity depth. The sweet spot for buyers priced out of Gachibowli who still want a short commute.", priceSqft: 7400, radiusKm: 2.2, yieldPct: 3.7, momentum: 12.6, image: IMG("photo-1580587771525-78b9dba3b914") },
  { name: "Tellapur", lat: 17.489, lng: 78.287, corridor: "West · Emerging", character: "Township living at township prices, still inside the ORR pull", summary: "Big-format projects with clubhouses, sports and internal roads. Infrastructure is catching up quickly and appreciation has outpaced the western average.", priceSqft: 6900, radiusKm: 2.6, yieldPct: 3.5, momentum: 15.1, image: IMG("photo-1613490493576-7fde63acd811") },
  { name: "Kollur", lat: 17.498, lng: 78.26, corridor: "West · Emerging", character: "The value frontier — largest floor plates for the money", summary: "Beyond Tellapur, where the largest new townships are rising. Longest commute of the western belt, and the lowest entry price.", priceSqft: 6400, radiusKm: 2.8, yieldPct: 3.3, momentum: 16.4, image: IMG("photo-1600585154340-be6161a56a0c") },
  { name: "Narsingi", lat: 17.3925, lng: 78.342, corridor: "West · ORR Growth Belt", character: "ORR-adjacent, villa-friendly, fast-improving", summary: "Direct ORR access with a growing villa and low-rise market. Popular with buyers who want land component without leaving the west.", priceSqft: 7600, radiusKm: 2.3, yieldPct: 3.4, momentum: 11.2, image: IMG("photo-1583608205776-bfd35f0d9f83") },
  { name: "Manikonda", lat: 17.4048, lng: 78.3772, corridor: "West · IT Core", character: "Dense, affordable-for-the-west, permanently in demand", summary: "A high-density rental engine feeding the Financial District and Gachibowli. Older stock dominates, but the location is unbeatable for the price.", priceSqft: 7200, radiusKm: 2.0, yieldPct: 4.3, momentum: 5.9, image: IMG("photo-1512917774080-9991f1c4c750") },
  { name: "Puppalaguda", lat: 17.402, lng: 78.36, corridor: "West · IT Core", character: "Quiet lanes minutes from the Financial District", summary: "Low-rise and mid-rise pockets with easy access to both Manikonda and the Financial District. Popular with families who want calm without distance.", priceSqft: 7500, radiusKm: 1.6, yieldPct: 3.8, momentum: 8.8, image: IMG("photo-1564013799919-ab600027ffc6") },
  { name: "Gopanpally", lat: 17.455, lng: 78.32, corridor: "West · Emerging", character: "University-adjacent, green, and rapidly densifying", summary: "Between Gachibowli and Nallagandla. Newer gated stock, good road width, and a short hop to the IT core.", priceSqft: 7300, radiusKm: 1.9, yieldPct: 3.6, momentum: 10.9, image: IMG("photo-1600596542815-ffad4c1539a9") },
  { name: "Khajaguda", lat: 17.42, lng: 78.369, corridor: "West · IT Core", character: "Rock formations, lake views, premium low-density", summary: "Distinctive granite landscape and a small premium market. Limited supply keeps prices firm.", priceSqft: 7900, radiusKm: 1.5, yieldPct: 3.5, momentum: 9.1, image: IMG("photo-1600047509807-ba8f99d2cdde") },
  { name: "Jubilee Hills", lat: 17.4326, lng: 78.4071, corridor: "Central · Premium", character: "Old money, wide roads, the city's most established address", summary: "Independent houses, boutique towers and the deepest luxury market in Hyderabad. Supply is scarce; transactions are relationship-driven.", priceSqft: 17500, radiusKm: 2.4, yieldPct: 2.4, momentum: 5.4, image: IMG("photo-1600585152220-90363fe7e115") },
  { name: "Banjara Hills", lat: 17.4126, lng: 78.4448, corridor: "Central · Premium", character: "Restaurants, galleries, hospitals — the cultural centre", summary: "Road No. 1 through 14 remain the most recognisable addresses in the city. Mixed-use, walkable, and consistently the highest ₹/sq.ft outside Jubilee Hills.", priceSqft: 16000, radiusKm: 2.5, yieldPct: 2.6, momentum: 4.8, image: IMG("photo-1600607687939-ce8a6c25118c") },
  { name: "Film Nagar", lat: 17.413, lng: 78.418, corridor: "Central · Premium", character: "Hillside lanes, low density, city views", summary: "Quiet residential pocket adjoining Jubilee Hills with elevation and privacy. Predominantly independent houses and boutique developments.", priceSqft: 12500, radiusKm: 1.4, yieldPct: 2.8, momentum: 6.1, image: IMG("photo-1600566753086-00f18fb6b3ea") },
  { name: "Somajiguda", lat: 17.425, lng: 78.459, corridor: "Central · Business", character: "Hospitals, hotels and central business convenience", summary: "Central, commercial and hospital-dense. Residential supply is limited and mostly older, but the location is unmatched for city access.", priceSqft: 11000, radiusKm: 1.3, yieldPct: 3.1, momentum: 4.2, image: IMG("photo-1502672260266-1c1ef2d93688") },
  { name: "Begumpet", lat: 17.4435, lng: 78.4645, corridor: "Central · Business", character: "Metro, airport road, and a mature mid-premium market", summary: "Excellent connectivity in every direction. Established stock, steady values, and a reliable rental market.", priceSqft: 9200, radiusKm: 1.8, yieldPct: 3.7, momentum: 4.9, image: IMG("photo-1560448204-e02f11c3d0e2") },
  { name: "Ameerpet", lat: 17.4374, lng: 78.4487, corridor: "Central · Business", character: "The city's busiest interchange — dense and always active", summary: "Metro junction and commercial density. High rental churn, compact units, and very strong yields.", priceSqft: 7800, radiusKm: 1.5, yieldPct: 4.4, momentum: 3.6, image: IMG("photo-1493809842364-78817add7ffb") },
  { name: "Punjagutta", lat: 17.427, lng: 78.452, corridor: "Central · Business", character: "Retail-heavy, metro-connected, centrally unbeatable", summary: "Adjoining Banjara Hills with better value. Strong for buyers who want central access without the premium address premium.", priceSqft: 9500, radiusKm: 1.3, yieldPct: 3.6, momentum: 5.2, image: IMG("photo-1554995207-c18c203602cb") },
  { name: "Kukatpally", lat: 17.4948, lng: 78.3996, corridor: "North-West", character: "KPHB energy — dense, self-sufficient, metro-linked", summary: "One of the largest residential catchments in the city, with its own retail and education ecosystem. Metro puts the IT core within reach.", priceSqft: 6800, radiusKm: 2.7, yieldPct: 4.2, momentum: 6.4, image: IMG("photo-1522708323590-d24dbb6b0267") },
  { name: "Miyapur", lat: 17.496, lng: 78.358, corridor: "North-West", character: "Metro terminus, wide arterials, strong mid-market supply", summary: "The metro terminus makes Miyapur a commuter favourite. Large mid-market projects and improving social infrastructure.", priceSqft: 6200, radiusKm: 2.5, yieldPct: 4.0, momentum: 8.7, image: IMG("photo-1600573472550-8090b5e0745e") },
  { name: "Bachupally", lat: 17.546, lng: 78.381, corridor: "North-West", character: "Gated townships, pharma jobs, and genuine space", summary: "Large gated communities at prices the west can no longer offer. Pharma and manufacturing employment nearby.", priceSqft: 5400, radiusKm: 2.4, yieldPct: 3.8, momentum: 11.3, image: IMG("photo-1616486338812-3dadae4b4ace") },
  { name: "Nizampet", lat: 17.51, lng: 78.387, corridor: "North-West", character: "Family mid-market with good school density", summary: "Established mid-market corridor with reliable resale liquidity and a strong rental base.", priceSqft: 5600, radiusKm: 2.2, yieldPct: 4.1, momentum: 8.1, image: IMG("photo-1600121848594-d8644e57abab") },
  { name: "Kompally", lat: 17.54, lng: 78.487, corridor: "North", character: "Villas, open land, and the calmest air in the city", summary: "Villa-led north corridor with lower density and larger plots. Popular with buyers prioritising space over commute.", priceSqft: 5500, radiusKm: 2.6, yieldPct: 3.6, momentum: 9.8, image: IMG("photo-1600566753190-17f0baa2a6c3") },
  { name: "Medchal", lat: 17.629, lng: 78.481, corridor: "North", character: "The northern frontier — land-led and long-horizon", summary: "Predominantly plots and early-stage projects. An investment play rather than an end-use address today.", priceSqft: 4200, radiusKm: 3.0, yieldPct: 3.0, momentum: 13.7, image: IMG("photo-1502005229762-cf1b2da7c5d6") },
  { name: "Alwal", lat: 17.503, lng: 78.506, corridor: "North", character: "Defence-adjacent, established, unhurried", summary: "Quiet, established residential character with cantonment influence. Steady rather than speculative.", priceSqft: 5000, radiusKm: 2.0, yieldPct: 3.9, momentum: 5.5, image: IMG("photo-1512918728675-ed5a9ecdebfd") },
  { name: "Secunderabad", lat: 17.4399, lng: 78.4983, corridor: "Central · Twin City", character: "The twin city — railways, cantonment, heritage streets", summary: "The rail gateway with its own distinct character. Mixed heritage and modern stock, and unmatched intercity connectivity.", priceSqft: 8200, radiusKm: 2.6, yieldPct: 3.8, momentum: 4.4, image: IMG("photo-1449158743715-0a90ebb6d2d8") },
  { name: "Uppal", lat: 17.4056, lng: 78.559, corridor: "East", character: "Stadium, metro, and the eastern industrial belt", summary: "Rajiv Gandhi International Cricket Stadium and metro connectivity anchor a fast-improving east. Value pricing with real infrastructure.", priceSqft: 5200, radiusKm: 2.3, yieldPct: 4.0, momentum: 9.2, image: IMG("photo-1590247813693-5541d1c609fd") },
  { name: "Pocharam", lat: 17.43, lng: 78.62, corridor: "East · IT", character: "The eastern IT node — Infosys, TCS and new townships", summary: "The east's answer to Gachibowli, anchored by large IT campuses. Township supply is deep and pricing is still early.", priceSqft: 4800, radiusKm: 2.8, yieldPct: 3.5, momentum: 14.9, image: IMG("photo-1600585154526-990dced4db0d") },
  { name: "Nagole", lat: 17.372, lng: 78.558, corridor: "East", character: "Metro terminus with steady mid-market supply", summary: "Metro terminus and improving arterials. A practical choice for the eastern employment belt.", priceSqft: 5100, radiusKm: 2.1, yieldPct: 4.1, momentum: 7.3, image: IMG("photo-1605276374104-dee2a0ed3cd6") },
  { name: "LB Nagar", lat: 17.351, lng: 78.552, corridor: "South-East", character: "Major junction, dense retail, strong rental churn", summary: "One of the city's busiest junctions with metro access. High density, high liquidity, mid-market pricing.", priceSqft: 5400, radiusKm: 2.4, yieldPct: 4.2, momentum: 6.7, image: IMG("photo-1600607687920-4e2a09cf159d") },
  { name: "Kothapet", lat: 17.368, lng: 78.539, corridor: "South-East", character: "Established, well-served, quietly liquid", summary: "Mature south-eastern pocket with reliable schools and retail. Consistent resale demand.", priceSqft: 5600, radiusKm: 1.8, yieldPct: 4.0, momentum: 6.0, image: IMG("photo-1600210492493-0946911123ea") },
  { name: "Attapur", lat: 17.366, lng: 78.427, corridor: "South", character: "PVNR Expressway access and airport convenience", summary: "Direct expressway access to the airport and the Financial District. Value pricing with improving supply.", priceSqft: 5800, radiusKm: 2.0, yieldPct: 3.9, momentum: 8.4, image: IMG("photo-1600566752355-35792bedcfea") },
  { name: "Shamshabad", lat: 17.2403, lng: 78.4294, corridor: "South · Airport", character: "Airport-adjacent, land-led, long horizon", summary: "Anchored by Rajiv Gandhi International Airport and the aerospace belt. Predominantly plots and early projects.", priceSqft: 4600, radiusKm: 3.0, yieldPct: 3.1, momentum: 12.1, image: IMG("photo-1600596542815-ffad4c1539a9") },
  { name: "Adibatla", lat: 17.233, lng: 78.567, corridor: "South-East · Aerospace", character: "Aerospace and defence employment, early-stage housing", summary: "TCS and aerospace campuses anchor an emerging employment node. Housing supply is young and priced accordingly.", priceSqft: 4400, radiusKm: 2.7, yieldPct: 3.2, momentum: 15.8, image: IMG("photo-1600047508788-786f3865b4b3") },
  { name: "Bandlaguda Jagir", lat: 17.36, lng: 78.38, corridor: "South-West", character: "Between the ORR and the old city, improving fast", summary: "Bridges the western employment belt and the southern city. Mid-market supply with steady absorption.", priceSqft: 5900, radiusKm: 2.2, yieldPct: 3.8, momentum: 10.2, image: IMG("photo-1600585154084-4e5fe7c39198") },
  { name: "Rajendranagar", lat: 17.322, lng: 78.403, corridor: "South", character: "Agricultural university green belt, airport access", summary: "Green, low-density and well placed for the airport. A quieter alternative to the western rush.", priceSqft: 5200, radiusKm: 2.5, yieldPct: 3.5, momentum: 9.6, image: IMG("photo-1512915922686-57c11dde9b6b") },
];

/** Organic-looking boundary: a radially perturbed ring, deterministic per locality. */
function makeBoundary(lat: number, lng: number, radiusKm: number, seed: number): [number, number][] {
  const rnd = mulberry32(seed);
  const STEPS = 40;
  const latR = radiusKm / 110.574;
  const lngR = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  // Low-frequency harmonics keep the shape smooth rather than spiky.
  const h = [0.18 * rnd(), 0.14 * rnd(), 0.1 * rnd()];
  const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
  const ring: [number, number][] = [];
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * Math.PI * 2;
    const wobble =
      1 + h[0] * Math.sin(2 * a + ph[0]) + h[1] * Math.sin(3 * a + ph[1]) + h[2] * Math.sin(5 * a + ph[2]);
    ring.push([lng + lngR * wobble * Math.cos(a), lat + latR * wobble * Math.sin(a)]);
  }
  return ring;
}

function makeHistory(current: number, momentum: number, seed: number) {
  const rnd = mulberry32(seed);
  const years = [2021, 2022, 2023, 2024, 2025, 2026];
  const out: { year: number; priceSqft: number }[] = [];
  let p = current;
  for (let i = years.length - 1; i >= 0; i--) {
    out.unshift({ year: years[i], priceSqft: Math.round(p / 10) * 10 });
    const drift = momentum / 100 + (rnd() - 0.5) * 0.05;
    p = p / (1 + Math.max(0.01, drift));
  }
  return out;
}

export const LOCALITIES: Locality[] = SEEDS.map((s, i) => {
  const slug = slugify(s.name);
  const seed = hashString(slug);
  return {
    id: `loc_${slug}`,
    cityId: HYDERABAD.id,
    name: s.name,
    slug,
    center: { lat: s.lat, lng: s.lng },
    boundary: makeBoundary(s.lat, s.lng, s.radiusKm, seed),
    corridor: s.corridor,
    character: s.character,
    summary: s.summary,
    avgPriceSqft: s.priceSqft,
    medianPrice: 0, // filled by the generator once properties exist
    rentalYieldPct: s.yieldPct,
    momentumPct: s.momentum,
    inventoryCount: 0,
    projectCount: 0,
    heroImage: s.image,
    priceHistory: makeHistory(s.priceSqft, s.momentum, seed + i),
    dataQuality: "estimated",
  };
});

export const LOCALITY_BY_SLUG = new Map(LOCALITIES.map((l) => [l.slug, l]));
export const LOCALITY_BY_ID = new Map(LOCALITIES.map((l) => [l.id, l]));
