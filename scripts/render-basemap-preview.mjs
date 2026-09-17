/**
 * Renders PropIT's opening map view offline, straight to a PNG.
 *
 * Exists because "the map looks blank" is ambiguous — it can mean tiles failed,
 * or that the palette has no contrast. Drawing real tiles in the real palette,
 * framed exactly as the app frames them, answers that without a browser.
 *
 *   node scripts/render-basemap-preview.mjs out.png          # city / ORR view
 *   node scripts/render-basemap-preview.mjs out.png --zoom 13
 */
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { gunzipSync, deflateSync } from "node:zlib";
import { writeFileSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
const OUT = args.find((a) => !a.startsWith("--")) ?? "basemap-preview.png";
const ZOOM = Number(args[args.indexOf("--zoom") + 1]) || 11;
// Draws real listings from the running dev server on top of the basemap.
const WITH_PROPERTIES = args.includes("--properties");
const API = process.env.SMOKE_BASE ?? "http://localhost:3000";
const SIZE = 1000;

// Kept in sync with LIGHT_PALETTE in src/lib/map/propit-style.ts
const P = {
  land: "#F0ECE3", landAlt: "#E7E1D4", water: "#A8C3D6", green: "#BED09F",
  road: "#FFFFFF", roadCasing: "#C2B8A0", orr: "#8A7B5E", orrCasing: "#F0ECE3",
  chip: "#FFFFFF", chipBorder: "#B4A98F", chipInk: "#17150F", cluster: "#17150F",
};
const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// Resolve the tile template from TileJSON — OpenFreeMap's planet path carries a
// build version that changes, so it must never be hard-coded.
const TILEJSON = await (await fetch("https://tiles.openfreemap.org/planet", { signal: AbortSignal.timeout(20000) })).json();
const TILE_TEMPLATE = TILEJSON.tiles[0];

const orr = JSON.parse(readFileSync("public/data/orr.json", "utf8"));
const [W, S, E, N] = orr.properties.bbox;
// Match the app's fitBounds padding so this is genuinely the opening shot.
const padX = (E - W) * 0.06, padY = (N - S) * 0.06;
const view = { w: W - padX, s: S - padY, e: E + padX, n: N + padY };

const lon2x = (lon, z) => ((lon + 180) / 360) * Math.pow(2, z);
const lat2y = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z);
};
const x0 = lon2x(view.w, ZOOM), x1 = lon2x(view.e, ZOOM);
const y0 = lat2y(view.n, ZOOM), y1 = lat2y(view.s, ZOOM);
const scale = Math.min(SIZE / (x1 - x0), SIZE / (y1 - y0));
const toPx = (lon, lat) => [(lon2x(lon, ZOOM) - x0) * scale, (lat2y(lat, ZOOM) - y0) * scale];

const px = Buffer.alloc(SIZE * SIZE * 3);
const fillAll = (c) => { const [r, g, b] = rgb(c); for (let i = 0; i < SIZE * SIZE; i++) { px[i*3]=r; px[i*3+1]=g; px[i*3+2]=b; } };
const setPx = (x, y, c) => { if (x<0||y<0||x>=SIZE||y>=SIZE) return; const i=((y|0)*SIZE+(x|0))*3; px[i]=c[0]; px[i+1]=c[1]; px[i+2]=c[2]; };
function stroke(x0_, y0_, x1_, y1_, colour, width) {
  const c = rgb(colour);
  const steps = Math.max(Math.abs(x1_-x0_), Math.abs(y1_-y0_), 1);
  const half = (width - 1) / 2;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps, x = x0_ + (x1_-x0_)*t, y = y0_ + (y1_-y0_)*t;
    for (let ox = -half; ox <= half; ox++) for (let oy = -half; oy <= half; oy++) setPx(x+ox, y+oy, c);
  }
}
function fillPoly(rings, colour) {
  const c = rgb(colour);
  let minY = Infinity, maxY = -Infinity;
  for (const r of rings) for (const p of r) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  for (let y = Math.max(0, minY|0); y <= Math.min(SIZE-1, maxY|0); y++) {
    const xs = [];
    for (const r of rings) for (let i=0, j=r.length-1; i<r.length; j=i++) {
      const a = r[i], b = r[j];
      if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k+1 < xs.length; k += 2)
      for (let x = Math.max(0, xs[k]|0); x <= Math.min(SIZE-1, xs[k+1]|0); x++) setPx(x, y, c);
  }
}

function disc(cx, cy, r, colour) {
  const c = rgb(colour);
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++)
      if (x * x + y * y <= r * r) setPx(cx + x, cy + y, c);
}
function chip(cx, cy, halfW, halfH) {
  const border = rgb(P.chipBorder), fill = rgb(P.chip), ink = rgb(P.chipInk);
  for (let y = -halfH; y <= halfH; y++)
    for (let x = -halfW; x <= halfW; x++) {
      const edge = Math.abs(y) === halfH || Math.abs(x) === halfW;
      // Clip the corners so it reads as a rounded plate.
      if (Math.abs(x) > halfW - 4 && Math.abs(y) > halfH - 3) continue;
      setPx(cx + x, cy + y, edge ? border : fill);
    }
  // A bar standing in for the price text, so density is honest.
  for (let y = -2; y <= 2; y++)
    for (let x = -halfW + 7; x <= halfW - 7; x++) setPx(cx + x, cy + y, ink);
}

// A 5x7 bitmap face, enough to letter the area pills legibly in the preview.
const FONT = {
  A:"01110100011000111111100011000110001",B:"11110100011000111110100011000111110",C:"01110100011000010000100001000101110",
  D:"11110100011000110001100011000111110",E:"11111100001000011110100001000011111",F:"11111100001000011110100001000010000",
  G:"01110100011000010111100011000101111",H:"10001100011000111111100011000110001",I:"11111001000010000100001000010011111",
  J:"00111000100001000010000101001001100",K:"10001100101010011000101011001010001",L:"10000100001000010000100001000011111",
  M:"10001110111010110001100011000110001",N:"10001110011010110011100011000110001",O:"01110100011000110001100011000101110",
  P:"11110100011000111110100001000010000",Q:"01110100011000110001101011001001101",R:"11110100011000111110101001001010001",
  S:"01111100001000001110000011000101110",T:"11111001000010000100001000010000100",U:"10001100011000110001100011000101110",
  V:"10001100011000110001100010101000100",W:"10001100011000110001101011101110001",X:"10001100010101000100010101000110001",
  Y:"10001100010101000100001000010000100",Z:"11111000010001000100010001000011111",
  "0":"01110100111010110011110011000101110","1":"00100011000010000100001000010001110","2":"01110100010000100110010001000011111",
  "3":"11111000100010000010000011000101110","4":"00010001100101010010111110001000010","5":"11111100001111000001000011000101110",
  "6":"00110010001000011110100011000101110","7":"11111000010001000100010000100001000","8":"01110100011000101110100011000101110",
  "9":"01110100011000101111000010001001100"," ":"00000000000000000000000000000000000",
  ".":"00000000000000000000000000110001100","-":"00000000000000011111000000000000000",
};
function glyph(ch, x, y, colour, scale = 1) {
  const bits = FONT[ch.toUpperCase()];
  if (!bits) return 5 * scale + scale;
  const c = rgb(colour);
  for (let r = 0; r < 7; r++)
    for (let col = 0; col < 5; col++)
      if (bits[r * 5 + col] === "1")
        for (let sy = 0; sy < scale; sy++)
          for (let sx = 0; sx < scale; sx++) setPx(x + col * scale + sx, y + r * scale + sy, c);
  return 5 * scale + scale;
}
function textWidth(t, scale = 1) { return t.length * (5 * scale + scale); }
function text(t, x, y, colour, scale = 1) {
  let cx = x;
  for (const ch of t) cx += glyph(ch, cx, y, colour, scale);
}

function roundedBox(x, y, w, h, fill, border, radius = 4) {
  const f = rgb(fill), b = rgb(border);
  for (let yy = 0; yy <= h; yy++)
    for (let xx = 0; xx <= w; xx++) {
      const dx = Math.min(xx, w - xx), dy = Math.min(yy, h - yy);
      if (dx < radius && dy < radius && (radius - dx) ** 2 + (radius - dy) ** 2 > radius * radius) continue;
      const edge = dx === 0 || dy === 0 || (dx < radius && dy < radius && (radius - dx) ** 2 + (radius - dy) ** 2 > (radius - 1) ** 2);
      setPx(x + xx, y + yy, edge ? b : f);
    }
}

function areaPill(cx, cy, name, count) {
  const s = 1;
  const compact = !name;
  const label = name.toUpperCase();
  const countTxt = String(count);
  const padL = compact ? 4 : 7, gap = compact ? 0 : 5, badgePad = 4;
  const nameW = compact ? 0 : textWidth(label, s);
  const badgeW = textWidth(countTxt, s) + badgePad * 2;
  const w = padL + nameW + gap + badgeW + (compact ? 4 : 4);
  const h = compact ? 15 : 17;
  const x = cx - Math.round(w / 2), y = cy - h - 4;
  roundedBox(x, y, w, h, P.chip, P.chipBorder, 7);
  text(label, x + padL, y + 5, P.chipInk, s);
  const bx = x + padL + nameW + gap;
  roundedBox(bx, y + 3, badgeW, h - 6, "#1E4A3C", "#1E4A3C", 5);
  text(countTxt, bx + badgePad, y + 5, "#F7F5F0", s);
  // stem down to the point on the ground
  for (let i = 0; i < 4; i++) setPx(cx, y + h + i, rgb(P.chipBorder));
}

// ---- PNG encoder (no native deps) ----
const crcTable = (() => { const t = []; for (let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c = c&1 ? 0xedb88320^(c>>>1) : c>>>1; t[n]=c>>>0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c^b)&0xff]^(c>>>8); return (c^0xffffffff)>>>0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function writePng(path) {
  const raw = Buffer.alloc((SIZE*3+1)*SIZE);
  for (let y = 0; y < SIZE; y++) { raw[y*(SIZE*3+1)] = 0; px.copy(raw, y*(SIZE*3+1)+1, y*SIZE*3, (y+1)*SIZE*3); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8]=8; ihdr[9]=2;
  writeFileSync(path, Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 6 })), chunk("IEND", Buffer.alloc(0)),
  ]));
}

// ---- fetch every tile the viewport touches ----
fillAll(P.land);
const tiles = [];
for (let tx = Math.floor(x0); tx <= Math.floor(x1); tx++)
  for (let ty = Math.floor(y0); ty <= Math.floor(y1); ty++) tiles.push([tx, ty]);
console.log(`stitching ${tiles.length} tiles at z${ZOOM}…`);

const decoded = await Promise.all(tiles.map(async ([tx, ty]) => {
  const url = TILE_TEMPLATE.replace("{z}", ZOOM).replace("{x}", tx).replace("{y}", ty);
  const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!res.ok) return null;
  let buf = Buffer.from(await res.arrayBuffer());
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
  return { tx, ty, tile: new VectorTile(new PbfReader(buf)) };
}));

let roads = 0, waters = 0;
const geomToPx = (tx, ty, extent) => (g) =>
  g.map((ring) => ring.map((p) => [
    (tx + p.x / extent - x0) * scale,
    (ty + p.y / extent - y0) * scale,
  ]));

for (const [name, colour] of [["landuse", P.landAlt], ["landcover", P.green], ["park", P.green], ["water", P.water]]) {
  for (const d of decoded) {
    if (!d) continue;
    const l = d.tile.layers[name];
    if (!l) continue;
    const to = geomToPx(d.tx, d.ty, l.extent);
    for (let i = 0; i < l.length; i++) {
      const f = l.feature(i);
      if (f.type !== 3) continue;
      fillPoly(to(f.loadGeometry()), colour);
      if (name === "water") waters++;
    }
  }
}

for (const [pass, colour, extra] of [["casing", P.roadCasing, 2], ["road", P.road, 0]]) {
  for (const d of decoded) {
    if (!d) continue;
    const l = d.tile.layers.transportation;
    if (!l) continue;
    const to = geomToPx(d.tx, d.ty, l.extent);
    for (let i = 0; i < l.length; i++) {
      const f = l.feature(i);
      if (f.type !== 2) continue;
      const cls = f.properties.class ?? "";
      const w = (/motorway|trunk/.test(cls) ? 4 : /primary/.test(cls) ? 3 : /secondary|tertiary/.test(cls) ? 2 : 1) + extra;
      for (const ring of to(f.loadGeometry()))
        for (let k = 0; k + 1 < ring.length; k++) stroke(ring[k][0], ring[k][1], ring[k+1][0], ring[k+1][1], colour, w);
      if (pass === "road") roads++;
    }
  }
}

// ---- the ORR, on top, exactly as the app layers it ----
let orrSegments = 0;
for (const [colour, width] of [[P.orrCasing, 7], [P.orr, 3]]) {
  for (const line of orr.features[0].geometry.coordinates) {
    const pts = line.map(([lon, lat]) => toPx(lon, lat));
    for (let k = 0; k + 1 < pts.length; k++) stroke(pts[k][0], pts[k][1], pts[k+1][0], pts[k+1][1], colour, width);
    if (colour === P.orr) orrSegments++;
  }
}

// ---- real listings from the API, drawn the way the map draws them ----
let markers = 0;
if (WITH_PROPERTIES) {
  try {
    const res = await fetch(`${API}/api/properties?type=buy&limit=1&zoom=${ZOOM}`, {
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    const useClusters = ZOOM < 12.5 && (data.localityCounts?.length ?? 0) > 0;

    if (useClusters) {
      // Same two-tier placement the map uses: named pills where they fit,
      // count-only badges where they do not, busiest area first.
      const FULL = (n) => n.length * 6.6 + 52, CW = 30, CH = 22, HH = 30, G = 6, CG = 2;
      const boxes = [];
      const box = (x, y, w, c) => {
        const h = c ? CH : HH, g = c ? CG : G;
        return { x1: x - w / 2 - g, y1: y - h - g, x2: x + w / 2 + g, y2: y + g };
      };
      const hits = (b) => boxes.some((o) => !(b.x2 < o.x1 || b.x1 > o.x2 || b.y2 < o.y1 || b.y1 > o.y2));

      const proj = [...data.localityCounts]
        .sort((a, b) => b.count - a.count)
        .map((a) => { const [x, y] = toPx(a.lng, a.lat); return { a, x, y }; })
        .filter((p) => !(p.x < -80 || p.y < -40 || p.x > SIZE + 80 || p.y > SIZE + 40));

      const spill = [], placed = [];
      for (const p of proj) {
        const b = box(p.x, p.y, FULL(p.a.name), false);
        if (hits(b)) { spill.push(p); continue; }
        boxes.push(b); placed.push({ ...p, compact: false });
      }
      for (const p of spill) {
        const b = box(p.x, p.y, CW, true);
        if (hits(b)) continue;
        boxes.push(b); placed.push({ ...p, compact: true });
      }
      // Draw least-busy first so the biggest areas sit on top.
      for (const p of placed.reverse()) {
        areaPill(p.x, p.y, p.compact ? "" : p.a.name, p.a.count);
        markers++;
      }
      console.log(`  areas: ${placed.filter(p=>!p.compact).length} named + ${placed.filter(p=>p.compact).length} badges of ${data.localityCounts.length}`);
    } else {
      for (const p of data.points) {
        const [cx, cy] = toPx(p.lng, p.lat);
        if (cx < -40 || cy < -40 || cx > SIZE + 40 || cy > SIZE + 40) continue;
        // Price chip: a rounded plate, the shape MapLibre stretches around text.
        chip(cx, cy, 34, 9);
        markers++;
      }
    }
  } catch (e) {
    console.log(`(properties skipped: ${e.message} — is the dev server running?)`);
  }
}

writePng(OUT);
console.log(`rendered ${OUT}`);
console.log(`roads ${roads} · water ${waters} · ORR segments ${orrSegments} · property markers ${markers}`);
