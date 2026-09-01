// The silhouette layers. Every one of these is a flat fill in a single colour
// taken from depthColor() — no gradients inside a shape, no interior detail,
// no outlines. Depth is carried entirely by which grey the shape is and how
// much it is blurred, which is the whole grammar of the look.

import type { Ctx, Frame } from "./draw.ts";
import { withBlur } from "./draw.ts";
import { depthColor, rgba, SKY_LOW, SKY_MID, SKY_TOP, FOG } from "./palette.ts";
import type { Rng } from "./rng.ts";
import { DEPTH, HORIZON, LAMP_POS } from "./layout.ts";

export function drawSky(ctx: Ctx, f: Frame): void {
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON * f.h);
  sky.addColorStop(0, SKY_TOP);
  sky.addColorStop(0.42, SKY_MID);
  sky.addColorStop(0.78, SKY_LOW);
  sky.addColorStop(1, FOG);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, f.w, HORIZON * f.h + 1);

  // A faint lift behind the silos: something is lit out there that we never
  // see. Cheap, and it stops the sky reading as a flat ramp.
  const glow = ctx.createRadialGradient(
    0.31 * f.w, HORIZON * f.h, 0,
    0.31 * f.w, HORIZON * f.h, 0.34 * f.w,
  );
  glow.addColorStop(0, rgba(FOG, 0.4));
  glow.addColorStop(1, rgba(FOG, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, f.w, HORIZON * f.h + 1);
}

/** A grain silo: cylinder, domed cap, and the thin leg it stands on. */
function silo(ctx: Ctx, f: Frame, cx: number, width: number, top: number): void {
  const x = cx * f.w;
  const w = width * f.w;
  const y = top * f.h;
  const base = (HORIZON + 0.005) * f.h;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, base);
  ctx.lineTo(x - w / 2, y);
  ctx.quadraticCurveTo(x, y - w * 0.62, x + w / 2, y);
  ctx.lineTo(x + w / 2, base);
  ctx.closePath();
  ctx.fill();
}

export function drawSilos(ctx: Ctx, f: Frame): void {
  ctx.fillStyle = depthColor(DEPTH.SILOS);
  silo(ctx, f, 0.175, 0.062, 0.3);
  silo(ctx, f, 0.243, 0.072, 0.255);
  silo(ctx, f, 0.318, 0.058, 0.315);

  // A gantry strung between the two tallest — the horizontal that tells you
  // they are one plant and not three separate towers.
  ctx.fillRect(0.16 * f.w, 0.288 * f.h, 0.19 * f.w, 3.5 * f.u);

  // No beacon, and no chimney here — see drawChimney.
}

/**
 * The one vertical tall enough to stand alone against the sky. It gets its own
 * pass because at the silos' value and the silos' blur it came out a pale soft
 * column and read as a second searchlight pointing upward — fighting the one
 * light the picture is actually about. Nearer value, more width, less blur.
 */
export function drawChimney(ctx: Ctx, f: Frame): void {
  ctx.fillStyle = depthColor(0.52);
  const cx = 0.552 * f.w;
  const top = 0.135 * f.h;
  const base = (HORIZON + 0.005) * f.h;
  ctx.beginPath();
  ctx.moveTo(cx - 0.0145 * f.w, base);
  ctx.lineTo(cx - 0.0062 * f.w, top);
  ctx.lineTo(cx + 0.0062 * f.w, top);
  ctx.lineTo(cx + 0.0145 * f.w, base);
  ctx.closePath();
  ctx.fill();
  // A lip at the top and two bands down the shaft: the details that say
  // chimney rather than column of air.
  ctx.fillRect(cx - 0.0092 * f.w, top, 0.0184 * f.w, 0.007 * f.h);
  for (const at of [0.34, 0.62]) {
    const y = top + (base - top) * at;
    const half = (0.0062 + 0.0083 * at) * f.w;
    ctx.fillRect(cx - half - 0.0016 * f.w, y, half * 2 + 0.0032 * f.w, 0.005 * f.h);
  }

  // No beacon on the chimney: a pale vertical with a bright cap read as a
  // second searchlight pointing up, which fought the one light the picture is
  // actually about.
}

export function drawTreeline(ctx: Ctx, f: Frame, rng: Rng): void {
  ctx.fillStyle = depthColor(DEPTH.TREELINE);
  const base = (HORIZON + 0.004) * f.h;
  ctx.fillRect(0, 0.596 * f.h, f.w, base - 0.596 * f.h);

  // Poplars: narrow spires of uneven height, which is what makes a treeline
  // read as trees rather than as a torn strip of paper.
  //
  // Their sizes are keyed to an index modulo the period rather than drawn as
  // the loop goes, so the strip is periodic and the tile wraps without a seam.
  const N = 120;
  const spire = Array.from({ length: N }, () => ({
    h: rng.range(0.012, 0.05) * f.h,
    w: rng.range(0.004, 0.009) * f.w,
    jitter: rng.range(-0.004, 0.004) * f.w,
  }));
  for (let i = -2; i <= N + 1; i += 1) {
    const { h, w, jitter } = spire[((i % N) + N) % N];
    const px = (i / N) * f.w + jitter;
    ctx.beginPath();
    ctx.moveTo(px - w, base);
    ctx.quadraticCurveTo(px - w * 0.5, base - h * 0.8, px, base - h);
    ctx.quadraticCurveTo(px + w * 0.5, base - h * 0.8, px + w, base);
    ctx.closePath();
    ctx.fill();
  }
}

export function drawPoles(ctx: Ctx, f: Frame): void {
  const colour = depthColor(DEPTH.POLES);
  ctx.fillStyle = colour;
  ctx.strokeStyle = colour;

  // Evenly spaced and level: a telegraph line panned past sideways does not
  // recede, and the even spacing is what lets the tile repeat honestly.
  const poles = [
    { x: 0.06, top: 0.3 },
    { x: 0.31, top: 0.294 },
    { x: 0.56, top: 0.303 },
    { x: 0.81, top: 0.297 },
    { x: 1.06, top: 0.3 },
  ];
  const base = (HORIZON + 0.008) * f.h;

  for (const p of poles) {
    const x = p.x * f.w;
    const top = p.top * f.h;
    const width = (base - top) * 0.016 + 1.6 * f.u;
    ctx.fillRect(x - width / 2, top, width, base - top);
    const arm = (base - top) * 0.18;
    ctx.fillRect(x - arm, top + (base - top) * 0.075, arm * 2, width * 0.75);
  }

  // Catenary wires. The sag is what sells them; a straight line reads as a
  // scratch on the image.
  ctx.lineWidth = 1.15 * f.u;
  for (let i = 0; i < poles.length - 1; i += 1) {
    const a = poles[i];
    const b = poles[i + 1];
    for (const side of [-1, 1]) {
      const ax = a.x * f.w + side * (base - a.top * f.h) * 0.18;
      const ay = a.top * f.h + (base - a.top * f.h) * 0.075;
      const bx = b.x * f.w + side * (base - b.top * f.h) * 0.18;
      const by = b.top * f.h + (base - b.top * f.h) * 0.075;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 0.055 * f.h, bx, by);
      ctx.stroke();
    }
  }
}

export function drawFence(ctx: Ctx, f: Frame): void {
  const colour = depthColor(DEPTH.FENCE);
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;

  const top = 0.574 * f.h;
  const base = 0.638 * f.h;
  const sagFrom = 0.78;
  const sagTo = 0.87;

  // One bay has given way. A fence in perfect repair reads as decoration;
  // a torn one reads as a place people stopped maintaining.
  const railY = (x: number): number => {
    if (x < sagFrom || x > sagTo) return top;
    const t = (x - sagFrom) / (sagTo - sagFrom);
    return top + Math.sin(t * Math.PI) * 0.03 * f.h;
  };

  // Diamond mesh, kept faint — you should read the posts and the top rail,
  // and only sense the mesh between them.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, f.w, base - top);
  ctx.clip();
  ctx.globalAlpha = 0.34;
  ctx.lineWidth = 0.9 * f.u;
  const gap = 0.011 * f.w;
  for (let x = -f.h; x < f.w + f.h; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + (base - top), base);
    ctx.moveTo(x, base);
    ctx.lineTo(x + (base - top), top);
    ctx.stroke();
  }
  ctx.restore();

  ctx.lineWidth = 1.8 * f.u;
  for (const at of [0, 0.5]) {
    ctx.beginPath();
    for (let x = 0; x <= 1.001; x += 0.005) {
      const y = railY(x) + (base - top) * at;
      if (x === 0) ctx.moveTo(0, y);
      else ctx.lineTo(x * f.w, y);
    }
    ctx.stroke();
  }

  for (let x = 0.012; x < 1; x += 0.0465) {
    ctx.fillRect(x * f.w - 1.6 * f.u, railY(x) - 0.006 * f.h, 3.2 * f.u, base - railY(x) + 0.006 * f.h);
  }
  ctx.restore();
}

export function drawFloodlight(ctx: Ctx, f: Frame, atX?: number): void {
  ctx.save();
  ctx.fillStyle = depthColor(DEPTH.FLOODLIGHT);
  const x = atX ?? LAMP_POS.x * f.w;
  const headY = LAMP_POS.y * f.h;
  const base = 0.66 * f.h;

  ctx.beginPath();
  ctx.moveTo(x - 0.0075 * f.w, base);
  ctx.lineTo(x - 0.0032 * f.w, headY + 0.012 * f.h);
  ctx.lineTo(x + 0.0032 * f.w, headY + 0.012 * f.h);
  ctx.lineTo(x + 0.0075 * f.w, base);
  ctx.closePath();
  ctx.fill();

  // The head is angled down-left, so the housing reads as the source of the
  // beam rather than as a box bolted to a stick.
  ctx.save();
  ctx.translate(x, headY + 0.012 * f.h);
  ctx.rotate(-0.42);
  ctx.beginPath();
  ctx.moveTo(-0.026 * f.w, 0);
  ctx.lineTo(-0.019 * f.w, -0.026 * f.h);
  ctx.lineTo(0.016 * f.w, -0.026 * f.h);
  ctx.lineTo(0.022 * f.w, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

export function drawGround(ctx: Ctx, f: Frame): void {
  // The ground recedes into the same haze as everything else, so it is a ramp
  // between two depths rather than one flat tone.
  // The far end of a flat plane is as far away as the treeline standing on it,
  // so it has to arrive at the treeline's value. Starting it darker left a
  // visible step right across the frame where the ground began.
  const g = ctx.createLinearGradient(0, HORIZON * f.h, 0, f.h);
  g.addColorStop(0, depthColor(0.64));
  g.addColorStop(0.12, depthColor(0.44));
  g.addColorStop(0.42, depthColor(DEPTH.GROUND_FAR * 0.72));
  g.addColorStop(1, depthColor(DEPTH.GROUND_NEAR));
  ctx.fillStyle = g;
  ctx.fillRect(0, HORIZON * f.h - 1, f.w, f.h - HORIZON * f.h + 1);
}

// ---------------------------------------------------------------------------
// Corn
// ---------------------------------------------------------------------------

export type Stalk = {
  x: number;
  base: number;
  height: number;
  lean: number;
  width: number;
  leaves: { at: number; dir: number; len: number; droop: number }[];
};

export function growStalks(
  rng: Rng,
  count: number,
  x0: number,
  x1: number,
  base: number,
  top: number,
  keep: (x: number) => number = () => 1,
): Stalk[] {
  const stalks: Stalk[] = [];
  for (let i = 0; i < count; i += 1) {
    const x = rng.range(x0, x1);
    const density = keep(x);
    if (rng.next() > density) continue;
    const full = base - top;
    // A slow roll across the field on top of the per-stalk jitter. Without it
    // every row tops out on the same line and the crop reads as clipped hedge.
    const roll = 1 + Math.sin(x * 7.3) * 0.15 + Math.sin(x * 17.1 + 2) * 0.09;
    stalks.push({
      x,
      base: base + rng.range(-0.009, 0.009),
      height: full * rng.range(0.62, 1.06) * roll * (0.72 + 0.28 * density),
      lean: rng.range(-0.22, 0.22),
      width: rng.range(1.5, 2.7),
      // Corn blades are long, narrow and hang. Short wide ones clustered near
      // the tip turn the whole field into a row of palm trees.
      leaves: Array.from({ length: rng.int(2, 4) }, () => ({
        at: rng.range(0.14, 0.86),
        dir: rng.next() < 0.5 ? -1 : 1,
        len: rng.range(0.13, 0.25),
        droop: rng.range(0.85, 1.5),
      })),
    });
  }
  return stalks;
}

/** One stalk: a leaning stem, drooping blades, and a tassel at the tip. */
function drawStalk(ctx: Ctx, f: Frame, s: Stalk, scale: number): void {
  const bx = s.x * f.w;
  const by = s.base * f.h;
  const h = s.height * f.h;
  const tipX = bx + s.lean * h;
  const tipY = by - h;
  const ctrlX = bx + s.lean * h * 0.28;
  const ctrlY = by - h * 0.55;

  ctx.lineWidth = s.width * f.u * scale;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
  ctx.stroke();

  for (const leaf of s.leaves) {
    // Point on the stem, from the same quadratic the stem was drawn with.
    const t = leaf.at;
    const mt = 1 - t;
    const px = mt * mt * bx + 2 * mt * t * ctrlX + t * t * tipX;
    const py = mt * mt * by + 2 * mt * t * ctrlY + t * t * tipY;
    const len = leaf.len * h;
    const tx = px + leaf.dir * len;
    const ty = py + len * leaf.droop - len * 0.12;
    ctx.beginPath();
    ctx.moveTo(px, py);
    // Out and slightly up, then falling away — the arch a blade makes under
    // its own weight.
    ctx.quadraticCurveTo(px + leaf.dir * len * 0.62, py - len * 0.26, tx, ty);
    ctx.quadraticCurveTo(px + leaf.dir * len * 0.34, py + len * 0.1, px, py + s.width * f.u * 1.6);
    ctx.closePath();
    ctx.fill();
  }

  ctx.lineWidth = s.width * f.u * scale * 0.6;
  for (const spread of [-0.35, 0, 0.35]) {
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.quadraticCurveTo(
      tipX + spread * h * 0.09,
      tipY - h * 0.05,
      tipX + spread * h * 0.14,
      tipY - h * 0.085,
    );
    ctx.stroke();
  }
}

/** The highest point any stalk in the set reaches, in normalised y, with room
 *  left for its tassel. The sway pass uses it to skip empty rows. */
export function crownOf(stalks: Stalk[]): number {
  let top = 1;
  for (const s of stalks) top = Math.min(top, s.base - s.height * 1.12);
  return top;
}

export function drawCorn(
  ctx: Ctx, f: Frame, stalks: Stalk[], depth: number, scale = 1, override?: string,
  wrap = false,
): void {
  const colour = override ?? depthColor(depth);
  ctx.save();
  ctx.fillStyle = colour;
  ctx.strokeStyle = colour;
  // A stalk near a tile edge has to appear on both sides of it, or the field
  // develops a bald stripe once per tile as the world scrolls past.
  const offsets = wrap ? [-1, 0, 1] : [0];
  for (const dx of offsets) {
    ctx.save();
    ctx.translate(dx * f.w, 0);
    for (const s of stalks) drawStalk(ctx, f, s, scale);
    ctx.restore();
  }
  ctx.restore();
}

/** The dense mass at the foot of the corn wall, with a ragged upper edge —
 *  without it the base of the field reads as a picket fence of separate stems. */
export function drawCornMass(
  ctx: Ctx, f: Frame, rng: Rng, baseY: number, depth: number, height: number,
  override?: string,
): void {
  ctx.save();
  ctx.fillStyle = override ?? depthColor(depth);
  const base = (baseY + 0.008) * f.h;
  // Height comes from a sum of sines of x rather than from the rng, so the
  // ragged edge is periodic in x and the tile repeats without a step in it.
  void rng;
  ctx.beginPath();
  ctx.moveTo(-0.02 * f.w, base);
  for (let x = -0.02; x <= 1.02; x += 0.006) {
    const roll =
      0.55 + 0.24 * Math.sin(x * Math.PI * 6) + 0.13 * Math.sin(x * Math.PI * 14 + 1.7)
      + 0.08 * Math.sin(x * Math.PI * 26 + 0.4);
    ctx.lineTo(x * f.w, base - height * roll * 2 * f.h);
  }
  ctx.lineTo(1.02 * f.w, base);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawWithBlur(ctx: Ctx, f: Frame, blur: number, paint: () => void): void {
  withBlur(ctx, blur * f.u, paint);
}
