/**
 * Stretchable pill images for price chips.
 *
 * MapLibre's `icon-text-fit` grows a stretchable image around its label, which
 * gives real WebGL price chips — no DOM markers, no per-marker layout cost.
 */
export interface PillSpec {
  fill: string;
  border: string;
  shadow: boolean;
}

const R = 8; // corner radius in CSS px
const PAD = 10;
const H = 30;
const W = 64; // base width; stretch handles the rest
const RATIO = 2;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function makePill(spec: PillSpec): {
  image: { width: number; height: number; data: Uint8Array };
  options: {
    pixelRatio: number;
    stretchX: [number, number][];
    stretchY: [number, number][];
    content: [number, number, number, number];
  };
} | null {
  if (typeof document === "undefined") return null;
  const pad = spec.shadow ? 4 : 0;
  const canvas = document.createElement("canvas");
  canvas.width = (W + pad * 2) * RATIO;
  canvas.height = (H + pad * 2) * RATIO;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(RATIO, RATIO);

  if (spec.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.22)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 1.5;
  }
  ctx.fillStyle = spec.fill;
  roundRect(ctx, pad + 0.5, pad + 0.5, W - 1, H - 1, R);
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = spec.border;
  ctx.lineWidth = 1;
  roundRect(ctx, pad + 0.5, pad + 0.5, W - 1, H - 1, R);
  ctx.stroke();

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const left = (pad + R + 2) * RATIO;
  const right = (pad + W - R - 2) * RATIO;
  const top = (pad + R) * RATIO;
  const bottom = (pad + H - R) * RATIO;

  return {
    image: {
      width: canvas.width,
      height: canvas.height,
      data: new Uint8Array(img.data.buffer),
    },
    options: {
      pixelRatio: RATIO,
      stretchX: [[left, right]],
      stretchY: [[top, bottom]],
      content: [(pad + PAD) * RATIO, top, (pad + W - PAD) * RATIO, bottom],
    },
  };
}

/**
 * Roads render white on the light basemap, so a white chip needs a definite
 * border to stay readable over a dense street network — the border and shadow
 * are what separate a price from the map underneath it.
 */
export const PILL_SPECS: Record<string, PillSpec> = {
  "pill-idle": { fill: "#FFFFFF", border: "#C9C9CE", shadow: true },
  "pill-hover": { fill: "#FFFFFF", border: "#0066CC", shadow: true },
  "pill-selected": { fill: "#0066CC", border: "#0066CC", shadow: true },
  "pill-seen": { fill: "#E8E8ED", border: "#D2D2D7", shadow: false },
};
