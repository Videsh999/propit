/**
 * Renders PropIT's real map to a PNG: actual raster basemap tiles, the actual
 * CSS/raster treatment, the real ORR, and the real area pins from the API.
 *
 *   node scripts/render-map-preview.mjs out.png --style voyager --zoom 11
 */
import { readFileSync, writeFileSync } from "node:fs";
import { decodePng, encodePng } from "./lib/png.mjs";

const args = process.argv.slice(2);
const OUT = args.find((a) => !a.startsWith("--") && a.endsWith(".png")) ?? "map-preview.png";
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1]; };
const STYLE = arg("style", "voyager");
const ZOOM = Number(arg("zoom", 11));
const TINT = arg("tint", "warm");
const SIZE = 1000;
const API = "http://localhost:3000";

const STYLES = {
  positron: "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
  voyager: "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
  voyager_nolabels: "https://a.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}@2x.png",
  positron_nolabels: "https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png",
  esri_gray: "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  esri_gray_ref: "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
  osm: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
};

const orr = JSON.parse(readFileSync("public/data/orr.json", "utf8"));
const [W, S, E, N] = orr.properties.bbox;
const padX = (E - W) * 0.06, padY = (N - S) * 0.06;
const view = { w: W - padX, s: S - padY, e: E + padX, n: N + padY };

const lon2x = (lon, z) => ((lon + 180) / 360) * 2 ** z;
const lat2y = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};
const x0 = lon2x(view.w, ZOOM), x1 = lon2x(view.e, ZOOM);
const y0 = lat2y(view.n, ZOOM), y1 = lat2y(view.s, ZOOM);
const scale = Math.min(SIZE / (x1 - x0), SIZE / (y1 - y0));
const toPx = (lon, lat) => [(lon2x(lon, ZOOM) - x0) * scale, (lat2y(lat, ZOOM) - y0) * scale];

const px = Buffer.alloc(SIZE * SIZE * 3, 240);
const setPx = (x, y, c) => { if (x<0||y<0||x>=SIZE||y>=SIZE) return; const i=((y|0)*SIZE+(x|0))*3; px[i]=c[0]; px[i+1]=c[1]; px[i+2]=c[2]; };
const getPx = (x, y) => { const i=((y|0)*SIZE+(x|0))*3; return [px[i],px[i+1],px[i+2]]; };
const rgb = (h) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];

// ---- composite the real tiles ----
const tiles = [];
for (let tx = Math.floor(x0); tx <= Math.floor(x1); tx++)
  for (let ty = Math.floor(y0); ty <= Math.floor(y1); ty++) tiles.push([tx, ty]);

const template = STYLES[STYLE] ?? STYLES.voyager;
console.log(`compositing ${tiles.length} ${STYLE} tiles at z${ZOOM}…`);

await Promise.all(tiles.map(async ([tx, ty]) => {
  const url = template
    .replace("{z}", ZOOM)
    .replace("{y}/{x}", `${ty}/${tx}`)
    .replace("{x}", tx)
    .replace("{y}", ty);
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) return;
  const img = decodePng(Buffer.from(await res.arrayBuffer()));
  const originX = (tx - x0) * scale, originY = (ty - y0) * scale;
  for (let dy = 0; dy < scale; dy++) {
    const sy = Math.floor((dy / scale) * img.height);
    const oy = originY + dy;
    if (oy < 0 || oy >= SIZE) continue;
    for (let dx = 0; dx < scale; dx++) {
      const ox = originX + dx;
      if (ox < 0 || ox >= SIZE) continue;
      const sx = Math.floor((dx / scale) * img.width);
      const si = (sy * img.width + sx) * 3;
      setPx(ox, oy, [img.rgb[si], img.rgb[si + 1], img.rgb[si + 2]]);
    }
  }
}));

// ---- the tint the app applies to the canvas ----
// Mirrors the CSS filter on the map container: a gentle warm shift so the
// basemap sits inside PropIT's paper palette instead of reading cold.
if (TINT !== "none") {
  const sepia = TINT === "warm" ? 0.16 : 0.3;
  const sat = 0.92, bright = 1.015;
  for (let i = 0; i < SIZE * SIZE; i++) {
    let r = px[i*3], g = px[i*3+1], b = px[i*3+2];
    const sr = 0.393*r + 0.769*g + 0.189*b;
    const sg = 0.349*r + 0.686*g + 0.168*b;
    const sb = 0.272*r + 0.534*g + 0.131*b;
    r = r + (sr - r) * sepia; g = g + (sg - g) * sepia; b = b + (sb - b) * sepia;
    const lum = 0.2126*r + 0.7152*g + 0.0722*b;
    r = lum + (r - lum) * sat; g = lum + (g - lum) * sat; b = lum + (b - lum) * sat;
    px[i*3]   = Math.max(0, Math.min(255, r * bright));
    px[i*3+1] = Math.max(0, Math.min(255, g * bright));
    px[i*3+2] = Math.max(0, Math.min(255, b * bright));
  }
}

// ---- drawing helpers ----
function stroke(ax, ay, bx, by, colour, width, alpha = 1) {
  const c = rgb(colour);
  const steps = Math.max(Math.abs(bx-ax), Math.abs(by-ay), 1);
  const half = (width - 1) / 2;
  for (let s = 0; s <= steps; s++) {
    const t = s/steps, x = ax + (bx-ax)*t, y = ay + (by-ay)*t;
    for (let ox = -half; ox <= half; ox++) for (let oy = -half; oy <= half; oy++) {
      if (alpha >= 1) setPx(x+ox, y+oy, c);
      else { const p = getPx(x+ox, y+oy); setPx(x+ox, y+oy, [p[0]+(c[0]-p[0])*alpha, p[1]+(c[1]-p[1])*alpha, p[2]+(c[2]-p[2])*alpha]); }
    }
  }
}
function roundedBox(x, y, w, h, fill, border, radius, shadow = true) {
  const f = rgb(fill), b = rgb(border);
  if (shadow) for (let yy=-1; yy<=h+2; yy++) for (let xx=-1; xx<=w+1; xx++) {
    const dx = Math.min(xx, w-xx), dy = Math.min(yy, h-yy);
    if (dx < radius && dy < radius && (radius-dx)**2 + (radius-dy)**2 > (radius+1)**2) continue;
    const p = getPx(x+xx, y+yy+1);
    setPx(x+xx, y+yy+1, [p[0]*0.9, p[1]*0.9, p[2]*0.89]);
  }
  for (let yy = 0; yy <= h; yy++) for (let xx = 0; xx <= w; xx++) {
    const dx = Math.min(xx, w-xx), dy = Math.min(yy, h-yy);
    if (dx < radius && dy < radius && (radius-dx)**2 + (radius-dy)**2 > radius*radius) continue;
    const edge = dx === 0 || dy === 0 || (dx < radius && dy < radius && (radius-dx)**2 + (radius-dy)**2 > (radius-1)**2);
    setPx(x+xx, y+yy, edge ? b : f);
  }
}

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
  "9":"01110100011000101111000010001001100"," ":"00000000000000000000000000000000000","'":"00100001000010000000000000000000000",
};
function text(t, x, y, colour) {
  const c = rgb(colour);
  let cx = x;
  for (const ch of t.toUpperCase()) {
    const bits = FONT[ch];
    if (bits) for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++)
      if (bits[r*5+col] === "1") setPx(cx+col, y+r, c);
    cx += 6;
  }
}
const textW = (t) => t.length * 6;

// ---- ORR ----
const ORR_CASING = "#FFFFFF", ORR_LINE = "#7A6A4E";
for (const [colour, width, alpha] of [[ORR_CASING, 8, 0.85], [ORR_LINE, 3, 0.92]]) {
  for (const line of orr.features[0].geometry.coordinates) {
    const pts = line.map(([lon, lat]) => toPx(lon, lat));
    for (let k = 0; k + 1 < pts.length; k++) stroke(pts[k][0], pts[k][1], pts[k+1][0], pts[k+1][1], colour, width, alpha);
  }
}

// ---- area pins from the live API ----
let named = 0, badges = 0;
try {
  const res = await fetch(`${API}/api/properties?type=buy&limit=1&zoom=${ZOOM}`, { signal: AbortSignal.timeout(15000) });
  const data = await res.json();
  const FULL = (n) => textW(n) + 46, CW = 30, CH = 22, HH = 30, G = 6, CG = 2;
  const boxes = [];
  const box = (x, y, w, c) => { const h = c?CH:HH, g = c?CG:G; return {x1:x-w/2-g, y1:y-h-g, x2:x+w/2+g, y2:y+g}; };
  const hits = (b) => boxes.some(o => !(b.x2<o.x1||b.x1>o.x2||b.y2<o.y1||b.y1>o.y2));
  const proj = [...data.localityCounts].sort((a,b)=>b.count-a.count)
    .map(a => { const [x,y] = toPx(a.lng, a.lat); return {a,x,y}; })
    .filter(p => !(p.x<-80||p.y<-40||p.x>SIZE+80||p.y>SIZE+40));
  const spill = [], placed = [];
  for (const p of proj) { const b = box(p.x,p.y,FULL(p.a.name),false); if (hits(b)) { spill.push(p); continue; } boxes.push(b); placed.push({...p, compact:false}); }
  for (const p of spill) { const b = box(p.x,p.y,CW,true); if (hits(b)) continue; boxes.push(b); placed.push({...p, compact:true}); }

  for (const p of placed.reverse()) {
    const name = p.compact ? "" : p.a.name;
    const countTxt = String(p.a.count);
    const padL = p.compact ? 5 : 8, gap = p.compact ? 0 : 6, bp = 4;
    const nameW = p.compact ? 0 : textW(name);
    const badgeW = textW(countTxt) + bp*2;
    const w = padL + nameW + gap + badgeW + 5;
    const h = p.compact ? 15 : 18;
    const x = p.x - Math.round(w/2), y = p.y - h - 5;
    stroke(p.x, y+h, p.x, y+h+5, "#B4A98F", 1, 0.9);
    roundedBox(x, y, w, h, "#FFFFFF", "#CFC4AC", Math.floor(h/2));
    if (!p.compact) text(name, x+padL, y+Math.floor(h/2)-3, "#1A1712");
    const bx = x + padL + nameW + gap;
    roundedBox(bx, y+3, badgeW, h-6, "#1E4A3C", "#1E4A3C", Math.floor((h-6)/2), false);
    text(countTxt, bx+bp, y+Math.floor(h/2)-3, "#FFFFFF");
    p.compact ? badges++ : named++;
  }
} catch (e) { console.log(`(pins skipped: ${e.message})`); }

writePngOut();
function writePngOut() {
  writeFileSync(OUT, encodePng(px, SIZE));
  console.log(`rendered ${OUT} — ${STYLE}, tint:${TINT} · ${named} named + ${badges} badge pins`);
}
