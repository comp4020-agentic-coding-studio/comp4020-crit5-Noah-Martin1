// The things in the field: small ones you jump, big ones you hide behind.
//
// Same grammar as everything else — flat silhouettes, no interior detail, no
// outline. What separates a drum from a boulder at forty pixels is entirely its
// outline and how it sits on the ground.

import type { Ctx, Frame } from "./draw.ts";
import { depthColor } from "./palette.ts";
import { DEPTH, GROUND_Y } from "./layout.ts";
import type { Prop } from "./layout.ts";

/** Jump obstacles sit at the rabbit's depth; cover is nearer the camera. */
const OBSTACLE_TONE = depthColor(0.085);
const COVER_TONE = depthColor(0.035);

/** A fallen trunk: a long low cylinder, tapered, with two broken stubs. */
function drawLog(ctx: Ctx, f: Frame, sx: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(sx - w, -h * 0.55);
  ctx.bezierCurveTo(sx - w * 0.4, -h * 1.05, sx + w * 0.4, -h * 1.05, sx + w, -h * 0.62);
  ctx.bezierCurveTo(sx + w * 1.05, -h * 0.2, sx + w * 0.6, 0, sx + w * 0.5, 0);
  ctx.lineTo(sx - w * 0.7, 0);
  ctx.bezierCurveTo(sx - w * 1.05, 0, sx - w * 1.05, -h * 0.3, sx - w, -h * 0.55);
  ctx.fill();
  // A broken branch, so it reads as fallen rather than sawn.
  ctx.beginPath();
  ctx.moveTo(sx + w * 0.15, -h * 0.9);
  ctx.lineTo(sx + w * 0.5, -h * 1.9);
  ctx.lineTo(sx + w * 0.62, -h * 1.82);
  ctx.lineTo(sx + w * 0.3, -h * 0.85);
  ctx.fill();
}

/** An angular rock — flat facets, so it never reads as a ball. */
function drawRock(ctx: Ctx, f: Frame, sx: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(sx - w, 0);
  ctx.lineTo(sx - w * 0.78, -h * 0.62);
  ctx.lineTo(sx - w * 0.2, -h);
  ctx.lineTo(sx + w * 0.45, -h * 0.86);
  ctx.lineTo(sx + w, -h * 0.28);
  ctx.lineTo(sx + w * 0.92, 0);
  ctx.closePath();
  ctx.fill();
}

/** Broken fence: three leaning posts and what is left of two rails. */
function drawFencePost(ctx: Ctx, f: Frame, sx: number, w: number, h: number): void {
  const posts = [-0.8, 0.05, 0.85];
  const leans = [0.10, -0.04, 0.22];
  ctx.save();
  for (let i = 0; i < posts.length; i += 1) {
    const px = sx + posts[i] * w;
    const top = -h * (i === 2 ? 0.62 : 1);
    ctx.save();
    ctx.translate(px, 0);
    ctx.rotate(leans[i]);
    ctx.fillRect(-w * 0.09, top, w * 0.18, -top);
    ctx.restore();
  }
  ctx.lineCap = "butt";
  ctx.lineWidth = Math.max(1, h * 0.1);
  ctx.strokeStyle = ctx.fillStyle;
  ctx.beginPath();
  ctx.moveTo(sx - w * 0.86, -h * 0.78);
  ctx.lineTo(sx + w * 0.1, -h * 0.84);
  ctx.moveTo(sx - w * 0.84, -h * 0.4);
  ctx.lineTo(sx + w * 0.95, -h * 0.34);
  ctx.stroke();
  ctx.restore();
}

/** A 44-gallon drum: barrelled sides, rolling hoops, a rim you can see is round. */
function drawDrum(ctx: Ctx, f: Frame, sx: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(sx - w * 0.86, 0);
  ctx.bezierCurveTo(sx - w * 1.02, -h * 0.32, sx - w * 1.02, -h * 0.68, sx - w * 0.86, -h);
  ctx.lineTo(sx + w * 0.86, -h);
  ctx.bezierCurveTo(sx + w * 1.02, -h * 0.68, sx + w * 1.02, -h * 0.32, sx + w * 0.86, 0);
  ctx.closePath();
  ctx.fill();
  // The top rim, seen slightly from above. Without it a barrel is just a box.
  ctx.beginPath();
  ctx.ellipse(sx, -h, w * 0.86, h * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const at of [0.30, 0.62]) {
    ctx.beginPath();
    ctx.ellipse(sx, -h * at, w * 1.02, h * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** An agricultural water tank: a corrugated cylinder on a stand, domed on top. */
function drawTank(ctx: Ctx, f: Frame, sx: number, w: number, h: number): void {
  const legs = h * 0.20;
  const bodyBot = -legs;
  const bodyTop = -h * 0.87;

  for (const lx of [-0.74, -0.32, 0.32, 0.74]) {
    ctx.fillRect(sx + lx * w - w * 0.045, -legs, w * 0.09, legs);
  }
  // A cross-brace, so the stand reads as built rather than as two posts.
  ctx.save();
  ctx.lineWidth = w * 0.045;
  ctx.strokeStyle = ctx.fillStyle;
  ctx.beginPath();
  ctx.moveTo(sx - w * 0.74, -legs * 0.15);
  ctx.lineTo(sx + w * 0.74, -legs * 0.8);
  ctx.moveTo(sx + w * 0.74, -legs * 0.15);
  ctx.lineTo(sx - w * 0.74, -legs * 0.8);
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(sx - w, bodyBot);
  ctx.lineTo(sx - w, bodyTop);
  ctx.bezierCurveTo(sx - w, bodyTop - h * 0.08, sx - w * 0.52, -h, sx, -h);
  ctx.bezierCurveTo(sx + w * 0.52, -h, sx + w, bodyTop - h * 0.08, sx + w, bodyTop);
  ctx.lineTo(sx + w, bodyBot);
  ctx.closePath();
  ctx.fill();
  // Rounded underside, so it sits on the stand as a cylinder does.
  ctx.beginPath();
  ctx.ellipse(sx, bodyBot, w, h * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
  // Corrugations.
  for (const at of [0.34, 0.52, 0.70]) {
    ctx.beginPath();
    ctx.ellipse(sx, -h * at, w * 1.03, h * 0.016, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * A gin trap, open and waiting: two jaws, a pan between them, a stake and chain.
 *
 * It has to be findable without being signposted, which is why it sits proud of
 * the ground rather than flush — the jaws break the horizon of the track, and
 * that silhouette is the only warning there is.
 */
function drawTrap(ctx: Ctx, f: Frame, sx: number, w: number, h: number): void {
  // Base plate and pan.
  ctx.fillRect(sx - w * 0.5, -h * 0.16, w, h * 0.16);
  ctx.fillRect(sx - w * 0.22, -h * 0.34, w * 0.44, h * 0.2);
  // The jaws, open and leaning out either side.
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.translate(sx + dir * w * 0.46, -h * 0.14);
    ctx.rotate(dir * 0.42);
    ctx.beginPath();
    ctx.moveTo(-w * 0.09, 0);
    ctx.quadraticCurveTo(-w * 0.16, -h * 0.9, dir * w * 0.1, -h * 1.5);
    ctx.lineTo(dir * w * 0.24, -h * 1.42);
    ctx.quadraticCurveTo(w * 0.02, -h * 0.85, w * 0.09, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Chain to a stake, trailing off.
  ctx.save();
  ctx.lineWidth = Math.max(1, h * 0.09);
  ctx.strokeStyle = ctx.fillStyle;
  ctx.beginPath();
  ctx.moveTo(sx + w * 0.4, -h * 0.08);
  ctx.quadraticCurveTo(sx + w * 1.3, -h * 0.02, sx + w * 1.9, -h * 0.3);
  ctx.stroke();
  ctx.restore();
  ctx.fillRect(sx + w * 1.86, -h * 0.62, w * 0.11, h * 0.62);
}

/** A big rounded mass, wider than it is tall. Cover you can read instantly. */
function drawBoulder(ctx: Ctx, f: Frame, sx: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(sx - w, 0);
  ctx.bezierCurveTo(sx - w * 1.02, -h * 0.55, sx - w * 0.66, -h, sx - w * 0.1, -h);
  ctx.bezierCurveTo(sx + w * 0.5, -h, sx + w * 0.98, -h * 0.6, sx + w, -h * 0.16);
  ctx.lineTo(sx + w, 0);
  ctx.closePath();
  ctx.fill();
}

const PAINTERS: Record<string, (c: Ctx, f: Frame, x: number, w: number, h: number) => void> = {
  log: drawLog,
  rock: drawRock,
  fence: drawFencePost,
  drum: drawDrum,
  tank: drawTank,
  boulder: drawBoulder,
  trap: drawTrap,
};

/**
 * Draw one prop standing on the ground line at `sx`. Everything is drawn in
 * ground-line-local coordinates (y = 0 is the ground, up is negative), so each
 * painter only has to describe a shape sitting on a line.
 */
export function drawProp(ctx: Ctx, f: Frame, prop: Prop, sx: number): void {
  const paint = PAINTERS[prop.kind];
  if (!paint) return;
  ctx.save();
  ctx.translate(0, GROUND_Y * f.h);
  ctx.fillStyle = prop.cover ? COVER_TONE : OBSTACLE_TONE;
  paint(ctx, f, sx, prop.half * f.w, prop.height * f.h);
  ctx.restore();
}
