import type { PossessionStatus, PropertyFilters, PropertyType } from "@/types";
import { formatPrice } from "@/lib/format";

export interface ParsedQuery {
  filters: Partial<PropertyFilters>;
  /** Place mentioned as a proximity target, e.g. "near Hitech City". */
  nearPlace: string | null;
  radiusKm: number | null;
  /** Locality names matched verbatim in the query. */
  localityMentions: string[];
  poiCategoryMentions: string[];
  /** Duration constraint in minutes, when the query expressed one. */
  maxMinutes: number | null;
  confidence: number;
  /** True when the query reads as a question rather than a search. */
  isQuestion: boolean;
  matchedTerms: string[];
}

const TYPE_WORDS: [RegExp, PropertyType][] = [
  [/\b(apartment|flat|apartments|flats)\b/i, "apartment"],
  [/\bvillas?\b/i, "villa"],
  [/\b(plot|plots|land)\b/i, "plot"],
  [/\b(independent house|individual house)\b/i, "independent_house"],
  [/\bpent\s?house(s)?\b/i, "penthouse"],
  [/\bfarm\s?house(s)?\b/i, "farmhouse"],
  [/\b(commercial|office space|shop)\b/i, "commercial"],
];

const POSSESSION_WORDS: [RegExp, PossessionStatus][] = [
  [/\b(ready to move|ready-to-move|ready possession|move in ready)\b/i, "ready"],
  [/\bunder construction\b/i, "under_construction"],
  [/\bwithin (6|six) months\b/i, "within_6_months"],
  [/\bwithin (a |one |1 )?year\b/i, "within_1_year"],
];

const AMENITY_WORDS: [RegExp, string][] = [
  [/\b(swimming )?pool\b/i, "pool"],
  [/\bgym|fitness\b/i, "gym"],
  [/\bclub\s?house\b/i, "clubhouse"],
  [/\bev charging\b/i, "ev-charging"],
  [/\bplay area|kids\b/i, "kids-play"],
  [/\bpet\b/i, "pet-park"],
  [/\bpower backup\b/i, "power-backup"],
];

const POI_WORDS: [RegExp, string][] = [
  [/\bmetro\b/i, "metro"],
  [/\bschools?\b/i, "school"],
  [/\bhospitals?\b/i, "hospital"],
  [/\bairport\b/i, "airport"],
  [/\bmalls?|shopping\b/i, "mall"],
  [/\bparks?|lakes?\b/i, "park"],
  [/\bcricket|stadium|sports\b/i, "stadium"],
  [/\boffice\b/i, "office_hub"],
  [/\brestaurants?\b/i, "restaurant"],
  [/\bgyms?\b/i, "gym"],
  [/\btemples?\b/i, "temple"],
];

const QUESTION_MARKERS =
  /\b(which|what|why|how|is it|are there|should i|better|compare|worth|explain|tell me about|good for|recommend|suggest)\b/i;

/** "2 crore", "1.5cr", "85 lakh", "50L", "₹1,20,00,000", "25k" → rupees. */
function parseAmount(raw: string): number | null {
  const s = raw.replace(/[₹,\s]/g, "").toLowerCase();
  const m = s.match(/^(\d+(?:\.\d+)?)(cr|crore|crores|l|lac|lakh|lakhs|k|thousand)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case "cr":
    case "crore":
    case "crores":
      return n * 1_00_00_000;
    case "l":
    case "lac":
    case "lakh":
    case "lakhs":
      return n * 1_00_000;
    case "k":
    case "thousand":
      return n * 1000;
    default:
      return n;
  }
}

const AMOUNT = String.raw`₹?\s*\d+(?:[.,]\d+)*\s*(?:cr|crore|crores|l|lac|lakh|lakhs|k)?`;

export function parseQuery(query: string, knownLocalities: string[] = []): ParsedQuery {
  const q = query.trim();
  const filters: Partial<PropertyFilters> = {};
  const matched: string[] = [];
  let confidence = 0;

  // --- listing type ---
  if (/\b(rent|rental|renting|lease|to let)\b/i.test(q)) {
    filters.listingType = "rent";
    matched.push("rent");
    confidence += 0.15;
  } else if (/\b(buy|sale|purchase|for sale)\b/i.test(q)) {
    filters.listingType = "buy";
    matched.push("buy");
    confidence += 0.1;
  }

  // --- bedrooms ---
  const bhk = q.match(/\b(\d)\s*[- ]?\s*(?:bhk|bed(?:room)?s?)\b/i);
  if (bhk) {
    filters.bedrooms = [parseInt(bhk[1], 10)];
    matched.push(`${bhk[1]} BHK`);
    confidence += 0.3;
  } else if (/\bstudio\b/i.test(q)) {
    filters.bedrooms = [0];
    matched.push("studio");
    confidence += 0.3;
  }

  // --- property type ---
  const types: PropertyType[] = [];
  for (const [re, t] of TYPE_WORDS) {
    if (re.test(q)) {
      types.push(t);
      matched.push(t.replace("_", " "));
    }
  }
  if (types.length) {
    filters.propertyTypes = types;
    confidence += 0.25;
  }

  // --- radius (extracted first, then stripped: "within 3 km" must never read as a budget) ---
  let radiusKm: number | null = null;
  const rad = q.match(/\bwithin\s*(\d+(?:\.\d+)?)\s*(km|kms|kilometers?|kilometres?)\b/i);
  if (rad) {
    radiusKm = parseFloat(rad[1]);
    matched.push(`${radiusKm} km radius`);
    confidence += 0.25;
  }
  const minutesMatch = q.match(/\bwithin\s*(\d+)\s*(min|mins|minutes?)\b/i);

  // Work on a string with distance/duration phrases removed.
  const qb = q
    .replace(/\bwithin\s*\d+(?:\.\d+)?\s*(?:km|kms|kilometers?|kilometres?)\b/gi, " ")
    .replace(/\bwithin\s*\d+\s*(?:min|mins|minutes?)\b/gi, " ");

  // --- budget ---
  const between = qb.match(new RegExp(String.raw`between\s*(${AMOUNT})\s*(?:and|-|to)\s*(${AMOUNT})`, "i"));
  const under = qb.match(new RegExp(String.raw`\b(?:under|below|less than|upto|up to|max(?:imum)?|within)\s*(${AMOUNT})`, "i"));
  const over = qb.match(new RegExp(String.raw`\b(?:over|above|more than|min(?:imum)?|starting)\s*(${AMOUNT})`, "i"));
  const range = qb.match(new RegExp(String.raw`(${AMOUNT})\s*(?:-|to|–)\s*(${AMOUNT})`, "i"));

  if (between) {
    const a = parseAmount(between[1]);
    const b = parseAmount(between[2]);
    if (a && b) {
      filters.priceMin = Math.min(a, b);
      filters.priceMax = Math.max(a, b);
      matched.push("budget range");
      confidence += 0.3;
    }
  } else if (under) {
    const v = parseAmount(under[1]);
    if (v) {
      filters.priceMax = v;
      matched.push("max budget");
      confidence += 0.3;
    }
  } else if (range) {
    const a = parseAmount(range[1]);
    const b = parseAmount(range[2]);
    if (a && b && a !== b) {
      filters.priceMin = Math.min(a, b);
      filters.priceMax = Math.max(a, b);
      matched.push("budget range");
      confidence += 0.25;
    }
  }
  if (over) {
    const v = parseAmount(over[1]);
    if (v) {
      filters.priceMin = v;
      matched.push("min budget");
      confidence += 0.2;
    }
  }

  // --- proximity target ---
  let nearPlace: string | null = null;
  const near = q.match(
    /\b(?:near(?:by)?|close to|around|next to|beside|from|of)\s+(?:the\s+)?([a-z][a-z0-9'.\- ]{2,40}?)(?=\s*(?:,|$|under|below|with|and|for|within|in\b|₹|\d))/i,
  );
  if (near) {
    nearPlace = near[1].trim().replace(/\s+(area|locality)$/i, "");
    matched.push(`near ${nearPlace}`);
    confidence += 0.2;
  }

  // --- explicit locality mentions ---
  const lower = q.toLowerCase();
  const localityMentions = knownLocalities.filter((name) => lower.includes(name.toLowerCase()));
  if (localityMentions.length) confidence += 0.25;

  // --- possession / amenities / poi categories ---
  const possession: PossessionStatus[] = [];
  for (const [re, p] of POSSESSION_WORDS) if (re.test(q)) possession.push(p);
  if (possession.length) {
    filters.possession = possession;
    confidence += 0.15;
    matched.push("possession");
  }

  const amenities: string[] = [];
  for (const [re, a] of AMENITY_WORDS) if (re.test(q)) amenities.push(a);
  if (amenities.length) {
    filters.amenities = amenities;
    confidence += 0.1;
  }

  const poiCategoryMentions: string[] = [];
  for (const [re, c] of POI_WORDS) if (re.test(q)) poiCategoryMentions.push(c);

  const isQuestion = QUESTION_MARKERS.test(q) || q.trimEnd().endsWith("?");

  return {
    filters,
    nearPlace,
    radiusKm,
    maxMinutes: minutesMatch ? parseInt(minutesMatch[1], 10) : null,
    localityMentions,
    poiCategoryMentions,
    confidence: Math.min(1, confidence),
    isQuestion,
    matchedTerms: matched,
  };
}

export function describeParsed(p: ParsedQuery): string {
  const bits: string[] = [];
  if (p.filters.bedrooms?.length)
    bits.push(p.filters.bedrooms.map((b) => (b === 0 ? "Studio" : `${b} BHK`)).join(" / "));
  if (p.filters.propertyTypes?.length)
    bits.push(p.filters.propertyTypes.map((t) => t.replace("_", " ")).join(" / "));
  if (p.filters.priceMin != null && p.filters.priceMax != null)
    bits.push(`${formatPrice(p.filters.priceMin)} – ${formatPrice(p.filters.priceMax)}`);
  else if (p.filters.priceMax != null) bits.push(`under ${formatPrice(p.filters.priceMax)}`);
  else if (p.filters.priceMin != null) bits.push(`above ${formatPrice(p.filters.priceMin)}`);
  if (p.localityMentions.length) bits.push(`in ${p.localityMentions.join(", ")}`);
  else if (p.nearPlace) bits.push(`near ${p.nearPlace}`);
  if (p.radiusKm) bits.push(`within ${p.radiusKm} km`);
  if (p.maxMinutes) bits.push(`within ${p.maxMinutes} min`);
  return bits.join(" · ");
}
