// The detonation: the one warm thing in a cold frame.
//
// Everything else in this piece spends its colour budget on a single red
// ribbon. The blast is the deliberate exception — it is the only light source
// left once it kills the floodlights, and the contrast is the point.

import type { Ctx, Frame } from "./draw.ts";
import { ASH, FIRE, FIRE_DEEP, LIGHT, FOG, mix, rgba } from "./palette.ts";
import { BLAST_PARALLAX, BLAST_X, HORIZON } from "./layout.ts";

export type Blast = {
  /** Seconds since detonation, or null before it. */
  t: number | null;
  /** 0..1, spikes when a wave launches — the player's precursor warning. */
  flare: number;
};

export function makeBlast(): Blast {
  return { t: null, flare: 0 };
}

/** Screen x of the column of smoke. Barely moves: it is a long way off. */
export function blastX(f: Frame, camX: number): number {
  return (BLAST_X - camX) * BLAST_PARALLAX * f.w + f.w / 2;
}

/**
 * Fireball, stem and cap, drawn behind the treeline so the field silhouettes
 * against it. The cloud rises and spreads on a curve that is fast for the first
 * few seconds and then almost still, which is what makes it read as enormous
 * and far away rather than close and quick.
 */
export function drawBlast(ctx: Ctx, f: Frame, blast: Blast, camX: number): void {
  if (blast.t === null) return;
  const t = blast.t;
  const x = blastX(f, camX);
  const ground = HORIZON * f.h;

  // Growth curves. `rise` is how far the cap has climbed, `swell` its spread.
  // Never quite settles. The exponential gives the first seconds their violence
  // and the linear creep keeps it growing for the whole run, so the thing
  // behind you is always bigger than last time you looked.
  const rise = (1 - Math.exp(-t / 7)) + t * 0.006;
  const swell = (1 - Math.exp(-t / 9)) + t * 0.009;
  const heat = Math.max(0, 1 - t / 14) + blast.flare * 0.55;

  const capY = ground - f.h * (0.10 + 0.38 * rise);
  const capR = f.w * (0.045 + 0.135 * swell);
  const stemW = f.w * (0.013 + 0.020 * swell);

  ctx.save();

  // Smoke first, so the fire sits inside it.
  const smokeTone = mix(FOG, LIGHT, 0.25);
  ctx.globalAlpha = 0.44;
  ctx.filter = `blur(${9 * f.u}px)`;

  // Stem, widening as it rises into the cap.
  ctx.fillStyle = smokeTone;
  ctx.beginPath();
  ctx.moveTo(x - stemW * 0.55, ground);
  ctx.bezierCurveTo(x - stemW * 0.8, ground - f.h * 0.14, x - stemW, capY + capR * 0.5, x - stemW * 1.1, capY);
  ctx.lineTo(x + stemW * 1.1, capY);
  ctx.bezierCurveTo(x + stemW, capY + capR * 0.5, x + stemW * 0.8, ground - f.h * 0.14, x + stemW * 0.55, ground);
  ctx.closePath();
  ctx.fill();

  // The cap: a squashed dome with a rolled underside.
  // A wide, flat anvil rather than a dome: the flatness is what separates a
  // mushroom cloud from weather.
  ctx.beginPath();
  ctx.ellipse(x, capY, capR * 1.18, capR * 0.46, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, capY + capR * 0.1, capR * 0.94, capR * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();

  // The skirt of dust thrown out along the ground.
  ctx.globalAlpha = 0.32;
  ctx.beginPath();
  ctx.ellipse(x, ground, f.w * (0.06 + 0.14 * swell), f.h * 0.035, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  // Then the fire inside it, which is what makes the smoke read as lit.
  if (heat > 0.01) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 1;
    ctx.filter = `blur(${13 * f.u}px)`;

    // Lifted clear of the corn wall. On the ground line the fire was behind
    // a metre of crop and the column never read as lit.
    const ballY = capY + capR * 0.36;
    const ballR = f.w * (0.026 + 0.040 * swell);
    const core = ctx.createRadialGradient(x, ballY, 0, x, ballY, ballR);
    core.addColorStop(0, rgba(LIGHT, 0.85 * heat));
    core.addColorStop(0.34, rgba(FIRE, 0.62 * heat));
    core.addColorStop(1, rgba(FIRE_DEEP, 0));
    ctx.fillStyle = core;
    ctx.fillRect(x - ballR, ballY - ballR, ballR * 2, ballR * 2);

    // A dimmer glow up in the cap, so the whole column is lit from within.
    const capGlow = ctx.createRadialGradient(x, capY, 0, x, capY, capR);
    capGlow.addColorStop(0, rgba(FIRE, 0.3 * heat));
    capGlow.addColorStop(1, rgba(FIRE_DEEP, 0));
    ctx.fillStyle = capGlow;
    ctx.fillRect(x - capR, capY - capR, capR * 2, capR * 2);
  }

  ctx.restore();
}

/**
 * The warm wash the blast lays over the whole field, strongest on its own side.
 * Drawn over the corn, because it is airlight between camera and subject — the
 * same reason the searchlight beams go over the rabbit.
 */
export function drawBlastLight(ctx: Ctx, f: Frame, blast: Blast, camX: number): void {
  if (blast.t === null) return;
  const t = blast.t;
  const strength = (0.1 + 0.5 * Math.max(0, 1 - t / 10) + blast.flare * 0.4);
  if (strength <= 0.01) return;
  const x = blastX(f, camX);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const wash = ctx.createLinearGradient(x, 0, x + f.w * 1.3, 0);
  wash.addColorStop(0, rgba(FIRE, 0.16 * strength));
  wash.addColorStop(0.45, rgba(FIRE, 0.06 * strength));
  wash.addColorStop(1, rgba(FIRE, 0));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, f.w, f.h);
  ctx.restore();
}

/** The first half-second: the sky goes white before anything else happens. */
export function drawFlash(ctx: Ctx, f: Frame, blast: Blast): void {
  if (blast.t === null) return;
  const p = blast.t / 0.75;
  if (p >= 1) return;
  const a = p < 0.12 ? 1 : Math.max(0, 1 - (p - 0.12) / 0.88);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = rgba(LIGHT, 0.92 * a * a);
  ctx.fillRect(0, 0, f.w, f.h);
  ctx.restore();
}

/**
 * The end of the clock: the blast arriving.
 *
 * It grows from the horizon, which in a scene graded by aerial perspective is
 * exactly the far distance — so the silos go first, then the treeline, then the
 * corn, and the foreground fringe is the last thing left before everything is
 * ash. Consuming the picture by depth rather than by a flat fade is what makes
 * it read as a front travelling through the world rather than a screen wipe.
 */
export function drawConsume(ctx: Ctx, f: Frame, p: number, camX: number): void {
  if (p <= 0) return;
  const q = Math.max(0, Math.min(1, p));
  const x = blastX(f, camX);
  const y = HORIZON * f.h;
  const reach = Math.hypot(f.w, f.h) * 1.6;
  const r = Math.max(1, reach * Math.pow(q, 0.75));

  ctx.save();
  const wash = ctx.createRadialGradient(x, y, 0, x, y, r);
  wash.addColorStop(0, rgba(ASH, 1));
  wash.addColorStop(0.68, rgba(ASH, 0.97));
  wash.addColorStop(0.9, rgba(ASH, 0.55));
  wash.addColorStop(1, rgba(ASH, 0));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, f.w, f.h);

  // Whatever the gradient has not reached by the end, take flat.
  if (q > 0.82) {
    ctx.globalAlpha = (q - 0.82) / 0.18;
    ctx.fillStyle = ASH;
    ctx.fillRect(0, 0, f.w, f.h);
  }
  ctx.restore();
}

/**
 * The small flash that goes with a wave being launched.
 *
 * Every shockwave starts as a flare in the fireball, and this is that flare
 * reaching the field a moment later — a lift across the whole frame, far
 * gentler than the detonation. It is the cue that a wave is on its way, and it
 * is deliberately subtle: the corn is what tells you where, this only tells you
 * *now*.
 */
export function drawFlare(ctx: Ctx, f: Frame, blast: Blast): void {
  if (blast.t === null || blast.flare <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = rgba(LIGHT, 0.14 * blast.flare * blast.flare);
  ctx.fillRect(0, 0, f.w, f.h);
  ctx.restore();
}
