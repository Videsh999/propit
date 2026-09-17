import { readFileSync } from "node:fs";
import { applyPropitStyle, LIGHT_PALETTE } from "@/lib/map/propit-style";
import type { StyleSpecification } from "maplibre-gl";

const raw = JSON.parse(readFileSync("/tmp/positron.json", "utf8")) as StyleSpecification;
const out = applyPropitStyle(structuredClone(raw), LIGHT_PALETTE);

const count = (s: StyleSpecification) =>
  s.layers.reduce<Record<string, number>>((a, l) => ((a[l.type] = (a[l.type] ?? 0) + 1), a), {});

console.log("IN  layers:", raw.layers.length, count(raw));
console.log("OUT layers:", out.layers.length, count(out));
console.log("OUT sources:", Object.keys(out.sources ?? {}));
console.log("sprite kept?", "sprite" in (out as Record<string, unknown>));
console.log("glyphs:", out.glyphs);

const dropped = raw.layers.filter((l) => !out.layers.some((o) => o.id === l.id)).map((l) => `${l.id}(${l.type})`);
console.log("\nDROPPED", dropped.length, ":", dropped.join(", "));

// Any output layer that references a source-layer that no longer exists?
const bad = out.layers.filter((l) => "source" in l && l.source && !(out.sources as Record<string, unknown>)[l.source as string]);
console.log("\nlayers with missing source:", bad.map((l) => l.id));
