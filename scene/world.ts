// The endless field.
//
// Every scrolling layer is baked once into a tile one frame-width across and
// then blitted as many times as it takes to cover the canvas, offset by the
// camera times that layer's parallax. Tiles are periodic by construction — the
// painters in layers.ts key their variation to an index or to a sum of sines
// rather than to a running rng — so the repeat has no seam in it.

import type { Ctx, Frame, Layer } from "./draw.ts";
import { blit, createLayer, drawGusted } from "./draw.ts";
import { depthColor, rgba, LIGHT } from "./palette.ts";
import type { Rng } from "./rng.ts";
import { makeRng } from "./rng.ts";
import {
  BURROW_W,
  CORN_BANDS,
  CORN_FORE,
  DEPTH,
  GROUND_Y,
  PARALLAX,
} from "./layout.ts";
import {
  crownOf,
  drawChimney,
  drawCorn,
  drawCornMass,
  drawFence,
  drawGround,
  drawPoles,
  drawSilos,
  drawSky,
  drawTreeline,
  growStalks,
} from "./layers.ts";
import type { Stalk } from "./layers.ts";
import { drawCornShadow } from "./atmosphere.ts";

export type World = {
  sky: Layer;
  ground: Layer;
  far: Layer;
  poles: Layer;
  fence: Layer;
  cornBack: Layer;
  cornFront: Layer;
  cornShadow: Layer;
  fore: Layer;
  scratch: Layer;
  beamLayer: Layer;
  crowns: { back: number; front: number; fore: number };
};

/** Repeat a tile across the canvas, offset by the camera. */
export function wrapBlit(
  ctx: Ctx, tile: HTMLCanvasElement, shiftPx: number, y0 = 0, rows = tile.height,
): void {
  const tw = tile.width;
  let x = (((shiftPx % tw) + tw) % tw) - tw;
  const limit = ctx.canvas.width;
  // Only the rows asked for: the sway scratch is shared between bands, so
  // blitting the whole surface drags the previous band's rows along with it.
  while (x < limit) {
    ctx.drawImage(tile, 0, y0, tw, rows, Math.round(x), y0, tw, rows);
    x += tw;
  }
}

/** Screen x for a world position, given the camera. */
export function screenX(f: Frame, worldX: number, camX: number, parallax = PARALLAX.ACTORS): number {
  return (worldX - camX) * parallax * f.w + f.w / 2;
}

export function buildWorld(f: Frame, seed: number): World {
  const width = f.w;
  const height = f.h;
  const rng: Rng = makeRng(seed);

  const bake = (paint: (ctx: Ctx) => void, blurPx = 0): Layer => {
    const raw = createLayer(width, height);
    paint(raw.ctx);
    if (blurPx <= 0) return raw;
    const out = createLayer(width, height);
    blit(out.ctx, raw.canvas, blurPx * f.u);
    return out;
  };

  const sky = bake((ctx) => drawSky(ctx, f));
  const ground = bake((ctx) => drawGround(ctx, f));

  // Silos, chimney and hedgerow share one tile: at 0.1 parallax they crawl, so
  // the repeat lands about twice a lap and reads as more of the same plant.
  const far = bake((ctx) => {
    drawSilos(ctx, f);
    drawChimney(ctx, f);
    drawTreeline(ctx, f, rng);
  }, 3.5);

  const poles = bake((ctx) => drawPoles(ctx, f), 1.5);
  const fence = bake((ctx) => drawFence(ctx, f), 1);

  const cornBack = createLayer(width, height);
  const cornFront = createLayer(width, height);
  const cornShadowSrc = createLayer(width, height);
  const groundTone = depthColor(DEPTH.GROUND_NEAR);
  let backCrown = 1;
  let frontCrown = 1;

  CORN_BANDS.forEach((band, i) => {
    const stalks: Stalk[] = growStalks(rng, band.count, 0, 1, band.base, band.top);
    // The two far bands share a tile and a parallax; the near one gets its own,
    // so the field still has thickness without a third full-frame canvas.
    const front = i === 2;
    const target = front ? cornFront : cornBack;
    drawCornMass(target.ctx, f, rng, band.base, band.depth, 0.012);
    drawCorn(target.ctx, f, stalks, band.depth, band.scale, undefined, true);
    if (front) {
      drawCorn(cornShadowSrc.ctx, f, stalks, band.depth, band.scale, groundTone, true);
      drawCornMass(cornShadowSrc.ctx, f, rng, band.base, band.depth, 0.012, groundTone);
      frontCrown = crownOf(stalks);
    } else {
      backCrown = Math.min(backCrown, crownOf(stalks));
    }
  });

  // The shadow the field throws is flattened and sheared once here, not once a
  // frame — it never changes shape.
  const cornShadow = createLayer(width, height);
  for (const dx of [-1, 0, 1]) {
    cornShadow.ctx.save();
    cornShadow.ctx.translate(dx * width, 0);
    drawCornShadow(cornShadow.ctx, f, cornShadowSrc.canvas, 1);
    cornShadow.ctx.restore();
  }

  const foreStalks = growStalks(rng, 34, 0, 1, CORN_FORE.base, CORN_FORE.top);
  const foreRaw = createLayer(width, height);
  drawCorn(foreRaw.ctx, f, foreStalks, DEPTH.CORN_FORE, 1.9, undefined, true);
  const fore = createLayer(width, height);
  blit(fore.ctx, foreRaw.canvas, 5.5 * f.u);

  return {
    sky, ground, far, poles, fence,
    cornBack, cornFront, cornShadow, fore,
    scratch: createLayer(width, height),
    beamLayer: createLayer(Math.round(width / 2), Math.round(height / 2)),
    crowns: {
      back: backCrown,
      front: frontCrown,
      fore: crownOf(foreStalks),
    },
  };
}

const bandTop = (h: number, crown: number): number => Math.max(0, Math.floor(crown * h - 4));
const bandBase = (h: number, baseY: number): number => Math.min(h, Math.ceil(baseY * h + 2));

/**
 * Repeat a corn tile across the canvas, then bend the result.
 *
 * Order matters, and it changed: the sway used to be applied to the *tile* and
 * the swayed tile repeated, which is why the whole field always moved as one.
 * A shockwave has to bend one part of the field and not another, so the tile is
 * wrapped into screen space first and the bend applied to that — `ampAt` is
 * then free to be a function of where you are looking.
 */
export function gustAndWrap(
  ctx: Ctx, world: World, f: Frame, tile: Layer,
  crown: number, topY: number, baseY: number, shiftPx: number,
  ampAt: (screenX: number) => number,
): void {
  const from = bandTop(f.h, crown);
  const to = bandBase(f.h, baseY);
  world.scratch.ctx.clearRect(0, from, f.w, to - from);
  wrapBlit(world.scratch.ctx, tile.canvas, shiftPx, from, to - from);
  drawGusted(ctx, world.scratch.canvas, topY * f.h, baseY * f.h, from, to, ampAt);
}

/**
 * The way out.
 *
 * It has to be unmistakable from across a field with nothing naming it, and it
 * has to look like something an animal dug rather than a target painted on the
 * ground. The earlier version was a clean ellipse inside a bright ring, which
 * read as a manhole.
 *
 * What fixes it is undercut and asymmetry: the mouth is bitten into a low bank
 * so there is dark earth *overhanging* it, the spoil is thrown out to one side
 * the way a real burrow's is, the opening is an irregular blob rather than a
 * circle, and grass grows ragged over the lip. Only the underside catches light
 * — a full rim is what made it read as drawn on rather than dug in.
 */
export function drawBurrow(ctx: Ctx, f: Frame, atX: number): void {
  const w = BURROW_W * f.w;
  const y = GROUND_Y * f.h;

  ctx.save();
  ctx.translate(atX, y);

  // Spoil, thrown out to the right and trailing off. Soft, because it is loose
  // earth and nothing about it should have an edge.
  ctx.save();
  ctx.filter = `blur(${3.5 * f.u}px)`;
  const mound = ctx.createLinearGradient(0, -w * 0.5, 0, w * 0.28);
  mound.addColorStop(0, depthColor(0.34));
  mound.addColorStop(1, depthColor(0.16));
  ctx.fillStyle = mound;
  ctx.beginPath();
  ctx.moveTo(-w * 1.15, w * 0.12);
  ctx.bezierCurveTo(-w * 1.0, -w * 0.30, -w * 0.45, -w * 0.44, w * 0.1, -w * 0.40);
  ctx.bezierCurveTo(w * 0.85, -w * 0.35, w * 1.5, -w * 0.16, w * 1.9, w * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // The bank the hole is bitten into: darker earth standing above the mouth, so
  // the opening has something to be *under*.
  ctx.fillStyle = depthColor(0.10);
  ctx.beginPath();
  ctx.moveTo(-w * 0.92, w * 0.1);
  ctx.bezierCurveTo(-w * 0.86, -w * 0.34, -w * 0.42, -w * 0.56, w * 0.06, -w * 0.54);
  ctx.bezierCurveTo(w * 0.56, -w * 0.52, w * 0.92, -w * 0.3, w * 0.98, w * 0.1);
  ctx.closePath();
  ctx.fill();

  // The mouth. Irregular, wider than tall, tilted — and the only pure black in
  // the frame, which is what makes it read as depth rather than as paint.
  const hole = ctx.createRadialGradient(0, -w * 0.06, 0, 0, -w * 0.06, w * 0.62);
  hole.addColorStop(0, "#000000");
  hole.addColorStop(0.74, "#010305");
  hole.addColorStop(1, "#0a1014");
  ctx.fillStyle = hole;
  ctx.beginPath();
  ctx.moveTo(-w * 0.62, w * 0.02);
  ctx.bezierCurveTo(-w * 0.66, -w * 0.26, -w * 0.34, -w * 0.42, w * 0.02, -w * 0.40);
  ctx.bezierCurveTo(w * 0.40, -w * 0.38, w * 0.64, -w * 0.20, w * 0.60, w * 0.04);
  ctx.bezierCurveTo(w * 0.44, w * 0.2, -w * 0.42, w * 0.2, -w * 0.62, w * 0.02);
  ctx.closePath();
  ctx.fill();

  // A little light caught on the lower lip only, where loose soil would sit.
  ctx.strokeStyle = depthColor(0.38);
  ctx.lineWidth = 1.8 * f.u;
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, w * 0.08);
  ctx.quadraticCurveTo(0, w * 0.24, w * 0.5, w * 0.06);
  ctx.stroke();

  // Grass over the lip, breaking the outline. Fixed blades rather than random
  // ones, so the burrow looks the same every time you find it.
  ctx.strokeStyle = depthColor(0.06);
  ctx.lineWidth = 1.5 * f.u;
  ctx.lineCap = "round";
  const blades = [-1.02, -0.78, -0.6, 0.66, 0.84, 1.06, 1.24];
  for (let i = 0; i < blades.length; i += 1) {
    const bx = blades[i] * w;
    const lean = (i % 3 === 0 ? -1 : 1) * (0.2 + (i % 4) * 0.12);
    const len = w * (0.32 + ((i * 7) % 5) * 0.07);
    ctx.beginPath();
    ctx.moveTo(bx, w * 0.06);
    ctx.quadraticCurveTo(bx + lean * len * 0.5, -len * 0.55, bx + lean * len, -len);
    ctx.stroke();
  }

  ctx.restore();
}
