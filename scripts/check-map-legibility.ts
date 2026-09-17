/**
 * Guards the basemap against becoming invisible.
 *
 * PropIT's map palette is deliberately restrained, and restraint is one bad
 * commit away from a blank grey rectangle — that failure looks exactly like a
 * broken map and wasted real debugging time once already. These thresholds
 * encode "a person can actually see this feature" so it cannot regress quietly.
 *
 *   npx tsx scripts/check-map-legibility.ts
 */
import { LIGHT_PALETTE, DARK_PALETTE, type PropitPalette } from "../src/lib/map/propit-style";

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function audit(name: string, p: PropitPalette): number {
  console.log(`\n${name} basemap — land ${p.land}`);
  // Roads are a fill over a casing. On a light map the casing is darker than
  // land and supplies the edge; on a dark map the roadway itself is lighter.
  // Either way, *something* about a road must separate it from the ground.
  const roadSeparation = Math.max(contrast(p.land, p.roadCasing), contrast(p.land, p.road));
  const checks: [string, number, number][] = [
    ["water vs land", contrast(p.land, p.water), 1.45],
    ["parks vs land", contrast(p.land, p.green), 1.3],
    ["roads vs land", roadSeparation, 1.6],
    ["road vs its casing", contrast(p.road, p.roadCasing), 1.5],
    ["buildings vs land", contrast(p.land, p.building), 1.15],
    ["boundaries vs land", contrast(p.land, p.boundary), 1.4],
    ["labels vs land", contrast(p.land, p.label), 4.5],
  ];
  let failed = 0;
  for (const [label, ratio, min] of checks) {
    const ok = ratio >= min;
    if (!ok) failed++;
    console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(20)} ${ratio.toFixed(2)}:1  (min ${min})`);
  }
  return failed;
}

const failures = audit("LIGHT", LIGHT_PALETTE) + audit("DARK", DARK_PALETTE);
console.log(
  failures === 0
    ? "\nBasemap is legible.\n"
    : `\n${failures} legibility threshold(s) missed — the map will read as blank.\n`,
);
// Exit is deferred to the end of the file so the glyph check below always runs.
process.exitCode = failures === 0 ? 0 : 1;

/**
 * Every text-font stack must resolve to a glyph file PropIT actually serves.
 *
 * MapLibre joins a multi-font stack into one request ("A,B/0-255.pbf"), which
 * only a compositing glyph server can answer. Against static hosting it 404s,
 * every label in that layer silently fails, and stalled glyphs can blank the
 * entire style. That shipped once; this stops it shipping again.
 */
import { existsSync, readFileSync as readText, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const stacks = new Map<string, string>();
for (const file of walk("src")) {
  const src = readText(file, "utf8");
  for (const m of src.matchAll(/text-font"?\]?\s*[:=]\s*\[([^\]]*)\]/g)) {
    const fonts = [...m[1].matchAll(/"([^"]+)"/g)].map((f) => f[1]);
    if (fonts.length) stacks.set(fonts.join(","), file);
  }
}

let glyphFailures = 0;
console.log("\nGlyph stacks");
for (const [stack, file] of stacks) {
  const onDisk = existsSync(join("public", "fonts", stack, "0-255.pbf"));
  if (!onDisk) glyphFailures++;
  console.log(`  ${onDisk ? "✓" : "✗"} ${stack.padEnd(28)} ${onDisk ? "" : `← no glyph file (${file})`}`);
}
if (glyphFailures) {
  console.log(`\n${glyphFailures} text-font stack(s) would 404 — every label using them fails.\n`);
  process.exitCode = 1;
} else {
  console.log("\nEvery text-font stack resolves to a served glyph file.\n");
}
