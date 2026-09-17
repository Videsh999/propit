import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { queryProperties } from "@/lib/data/repository";
import { formatPrice } from "@/lib/format";
import type { Anchor } from "@/types";

/**
 * Real data for the homepage story section.
 *
 * The story explains the product with the product's own data: the actual Outer
 * Ring Road, an actual office and school, and the actual homes that satisfy
 * both. An illustration would be easier and would be a small lie.
 */

const VIEW = 1000;

export interface StoryPoint {
  x: number;
  y: number;
}

export interface StoryHome extends StoryPoint {
  id: string;
  label: string;
}

export interface StoryData {
  orrPath: string;
  /** Where the camera pushes in to, and how far. */
  focus: { x: number; y: number; zoom: number };
  office: StoryPoint & { name: string };
  school: StoryPoint & { name: string };
  officeRadius: number;
  schoolRadius: number;
  homes: StoryHome[];
  /**
   * Every matching home as a plain point, for the compact diagram.
   *
   * `homes` is a short, collision-filtered set because those carry price chips
   * and must not overlap. Dots have no such constraint, so they can show the
   * real density of the result — which is the whole point of the picture.
   */
  homeDots: StoryPoint[];
  /**
   * Which localities the shared ground actually lands in, busiest first.
   *
   * The section used to state a total and stop, which left a lot of page
   * saying very little. These are the names a Hyderabad buyer would recognise
   * and the counts that make the total mean something.
   */
  zoneLocalities: { name: string; count: number; fromPrice: string }[];
  totalHomes: number;
  officeKm: number;
  schoolKm: number;
}

export function buildStoryData(): StoryData {
  const file = path.join(process.cwd(), "public", "data", "orr.json");
  const orr = JSON.parse(readFileSync(file, "utf8")) as {
    properties: { bbox: [number, number, number, number] };
    features: { geometry: { coordinates: [number, number][][] } }[];
  };

  const [w, s, e, n] = orr.properties.bbox;
  const pad = 0.1;
  const spanLng = e - w;
  const spanLat = n - s;
  const west = w - spanLng * pad;
  const south = s - spanLat * pad;
  const east = e + spanLng * pad;
  const north = n + spanLat * pad;

  // Equirectangular with a latitude correction — accurate enough at city scale.
  const latMid = ((south + north) / 2) * (Math.PI / 180);
  const kx = Math.cos(latMid);
  const width = (east - west) * kx;
  const height = north - south;
  const scale = VIEW / Math.max(width, height);
  const offX = (VIEW - width * scale) / 2;
  const offY = (VIEW - height * scale) / 2;

  const project = (lng: number, lat: number): StoryPoint => ({
    x: Math.round((offX + (lng - west) * kx * scale) * 10) / 10,
    y: Math.round((offY + (north - lat) * scale) * 10) / 10,
  });

  // Thin the ring for the SVG: its shape survives at a fraction of the nodes.
  const d = orr.features[0].geometry.coordinates
    .map((line) =>
      line
        .filter((_, i) => i === 0 || i === line.length - 1 || i % 2 === 0)
        .map(([lng, lat], i) => {
          const p = project(lng, lat);
          return `${i === 0 ? "M" : "L"}${p.x} ${p.y}`;
        })
        .join(""),
    )
    .join("");

  // A real office and a real school, and the real homes that satisfy both.
  const officeLoc = { lat: 17.4155, lng: 78.341 };
  const schoolLoc = { lat: 17.4419, lng: 78.3341 };
  const officeKm = 6;
  const schoolKm = 5;

  const anchors: Anchor[] = [
    { id: "story-office", label: "Office", kind: "office", location: officeLoc, address: "Financial District", maxKm: officeKm, weight: 1 },
    { id: "story-school", label: "School", kind: "school", location: schoolLoc, address: "Oakridge International", maxKm: schoolKm, weight: 1 },
  ];

  const result = queryProperties({ filters: { listingType: "buy" }, anchors, sort: "fit", limit: 140 });

  // km → SVG units, measured along longitude at this latitude.
  const kmPerDegLng = 111.32 * Math.cos(officeLoc.lat * (Math.PI / 180));
  const unitsPerKm = (kx * scale) / kmPerDegLng;

  const office = project(officeLoc.lng, officeLoc.lat);
  const school = project(schoolLoc.lng, schoolLoc.lat);
  const officeRadius = Math.round(officeKm * unitsPerKm);
  const schoolRadius = Math.round(schoolKm * unitsPerKm);

  // The camera frames the overlap: centred between the anchors, zoomed so the
  // smaller radius fills a healthy share of the stage.
  const ZOOM = Math.max(2, Math.min(3.4, 300 / Math.min(officeRadius, schoolRadius)));
  const focus = {
    x: Math.round((office.x + school.x) / 2),
    y: Math.round((office.y + school.y) / 2),
    zoom: Math.round(ZOOM * 100) / 100,
  };

  /**
   * Pick homes that will not collide once zoomed.
   *
   * A chip is ~88×32 on screen; divided by the zoom that is its footprint in map
   * units. Best-fit homes are placed first, so the ones shown are the strongest
   * matches that the stage has room to show legibly.
   */
  const chipW = 96 / ZOOM;
  const chipH = 40 / ZOOM;
  const anchorGuard = 46 / ZOOM;
  const placed: { x: number; y: number }[] = [
    { x: office.x, y: office.y },
    { x: school.x, y: school.y },
  ];
  const homes: StoryHome[] = [];
  for (const p of result.items) {
    const pt = project(p.location.lng, p.location.lat);
    const clearOfChips = placed.slice(2).every((q) => Math.abs(q.x - pt.x) > chipW || Math.abs(q.y - pt.y) > chipH);
    const clearOfAnchors = placed.slice(0, 2).every((q) => Math.hypot(q.x - pt.x, q.y - pt.y) > anchorGuard);
    // Keep chips inside the visible frame once the camera has pushed in.
    const inFrame = Math.abs(pt.x - focus.x) < 470 / ZOOM && Math.abs(pt.y - focus.y) < 440 / ZOOM;
    if (!clearOfChips || !clearOfAnchors || !inFrame) continue;
    placed.push(pt);
    homes.push({ id: p.id, label: formatPrice(p.price), ...pt });
    if (homes.length >= 9) break;
  }

  const homeDots: StoryPoint[] = result.items
    .slice(0, 140)
    .map((p) => project(p.location.lng, p.location.lat));

  const zoneLocalities = result.localityCounts.slice(0, 4).map((l) => ({
    name: l.name,
    count: l.count,
    fromPrice: formatPrice(l.minPrice),
  }));

  return {
    orrPath: d,
    focus,
    homeDots,
    zoneLocalities,
    office: { ...office, name: "Financial District" },
    school: { ...school, name: "Oakridge International" },
    officeRadius,
    schoolRadius,
    homes,
    totalHomes: result.total,
    officeKm,
    schoolKm,
  };
}
