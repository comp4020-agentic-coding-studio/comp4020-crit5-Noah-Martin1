// Shared canvas plumbing: a frame that carries its own scale unit, offscreen
// layers, and the blur used to fake depth of field.

export type Ctx = CanvasRenderingContext2D;

/** The drawing surface. `u` is one unit at the reference width, so stroke
 *  weights written once hold at every size. */
export type Frame = { w: number; h: number; u: number };

const REFERENCE_WIDTH = 1600;

export function frameOf(w: number, h: number): Frame {
  return { w, h, u: w / REFERENCE_WIDTH };
}

export type Layer = { canvas: HTMLCanvasElement; ctx: Ctx };

export function createLayer(w: number, h: number): Layer {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  return { canvas, ctx };
}

// Canvas filters are how the scene gets depth of field. Everything current
// supports them; where they are missing the piece should degrade to crisp
// rather than to broken, so this is a feature test and not a version test.
export const CAN_BLUR = ((): boolean => {
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return false;
  probe.filter = "blur(2px)";
  return probe.filter === "blur(2px)";
})();

export function blit(ctx: Ctx, layer: HTMLCanvasElement, blurPx = 0): void {
  if (blurPx > 0 && CAN_BLUR) {
    ctx.save();
    ctx.filter = `blur(${blurPx}px)`;
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
    return;
  }
  ctx.drawImage(layer, 0, 0);
}

export function withBlur(ctx: Ctx, blurPx: number, paint: () => void): void {
  ctx.save();
  if (blurPx > 0 && CAN_BLUR) ctx.filter = `blur(${blurPx}px)`;
  paint();
  ctx.restore();
}

/**
 * Redraw a band of already-composed, screen-space corn with a horizontal bend
 * that varies along the field.
 *
 * The old sway re-blitted the tile in ~80 horizontal 3px rows, which could give
 * every row its own offset but could never give every *column* one — and a
 * shockwave crossing the field is precisely a bend that varies with x.
 *
 * So this slices vertically instead and shears each slice with a transform:
 * SLICES draws where there were 80, which is why a wave that travels through
 * every corn layer costs less than the still sway it replaces. Three sub-bands
 * per slice approximate the quadratic falloff of the old version, so roots stay
 * planted while tops move.
 *
 * `ampAt` is in screen pixels and returns the offset at the top of the band.
 */
const SLICES = 12;
const SUB = 3;

export function drawGusted(
  ctx: Ctx,
  src: HTMLCanvasElement,
  topPx: number,
  basePx: number,
  fromPx: number,
  toPx: number,
  ampAt: (screenX: number) => number,
): void {
  const span = Math.max(1, basePx - topPx);
  const from = Math.max(0, Math.floor(fromPx));
  const to = Math.min(src.height, Math.ceil(toPx));
  if (to <= from) return;

  const sliceW = ctx.canvas.width / SLICES;
  const bandH = (to - from) / SUB;

  for (let i = 0; i < SLICES; i += 1) {
    const x0 = i * sliceW;
    const amp = ampAt(x0 + sliceW / 2);

    for (let j = 0; j < SUB; j += 1) {
      const yA = from + j * bandH;
      const yB = yA + bandH;
      // Offsets at the two edges of this sub-band, on the same quadratic
      // falloff the row-based sway used.
      const aboveA = Math.max(0, Math.min(1, (basePx - yA) / span));
      const aboveB = Math.max(0, Math.min(1, (basePx - yB) / span));
      const oA = amp * aboveA * aboveA;
      const oB = amp * aboveB * aboveB;
      const slope = (oB - oA) / Math.max(1, yB - yA);

      ctx.save();
      // Clipped in identity space, so the shear below cannot leak sideways
      // into the neighbouring slice and double-draw the seam.
      ctx.beginPath();
      ctx.rect(x0, yA, sliceW + 1, bandH + 1);
      ctx.clip();
      ctx.transform(1, 0, slope, 1, oA - slope * yA, 0);
      // Read a little either side of the slice: the shear pulls content in
      // from beyond its own edges.
      const pad = Math.abs(amp) + 2;
      const sx = Math.max(0, x0 - pad);
      const sw = Math.min(src.width - sx, sliceW + pad * 2);
      if (sw > 0) {
        ctx.drawImage(src, sx, yA, sw, bandH + 1, sx, yA, sw, bandH + 1);
      }
      ctx.restore();
    }
  }
}
