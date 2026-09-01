// Everything that is not an object: the beam, what it lands on, what it fails
// to reach, and the grain that binds the layers into one photographed image.

import type { Ctx, Frame, Layer } from "./draw.ts";
import { createLayer, withBlur } from "./draw.ts";
import { LIGHT, LAMP, rgba, FOG, depthColor } from "./palette.ts";
import type { Rng } from "./rng.ts";
import { noise1d } from "./rng.ts";
import { CONE_SPREAD, CORN_WALL, LAMP_POS, POOL } from "./layout.ts";

export type Beam = { ax: number; ay: number; angle: number; len: number };

/** The beam, resolved into pixels. Everything lit reads off this. */
export function beamOf(f: Frame, t: number, lampScreenX = LAMP_POS.x * f.w): Beam {
  const ax = lampScreenX;
  const ay = LAMP_POS.y * f.h;
  const angle =
    Math.atan2(POOL.y * f.h - ay, POOL.x * f.w - (LAMP_POS.x * f.w)) +
    // A slow breath, not a sweep. A searchlight that scans reads as an event
    // in a story; one that drifts reads as a place that has been like this for
    // a long time.
    Math.sin(t * 0.44) * 0.05;
  return { ax, ay, angle, len: 1.5 * f.h };
}

/** Arc lamps wander rather than buzz, so the flicker rides smooth noise. */
export function flickerOf(t: number): number {
  return 0.88 + noise1d(t * 2.6, 11) * 0.16 + noise1d(t * 11, 3) * 0.04;
}

/** How strongly a point sits inside the beam: 0 outside, 1 on the axis. */
export function beamIntensity(beam: Beam, x: number, y: number): number {
  const dx = x - beam.ax;
  const dy = y - beam.ay;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-4) return 1;
  let delta = Math.atan2(dy, dx) - beam.angle;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const across = 1 - Math.min(1, Math.abs(delta) / CONE_SPREAD);
  const along = Math.max(0, 1 - dist / beam.len);
  return across * across * along;
}

export function drawLampBloom(ctx: Ctx, f: Frame, beam: Beam, flicker: number): void {
  const r = 0.075 * f.w;
  const glow = ctx.createRadialGradient(beam.ax, beam.ay, 0, beam.ax, beam.ay, r);
  glow.addColorStop(0, rgba(LAMP, 0.62 * flicker));
  glow.addColorStop(0.25, rgba(LAMP, 0.18 * flicker));
  glow.addColorStop(1, rgba(LAMP, 0));
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = glow;
  ctx.fillRect(beam.ax - r, beam.ay - r, r * 2, r * 2);
  ctx.restore();
}

/**
 * The airlight itself. Drawn late — over the corn and over the rabbit — because
 * this is light scattering in the air between the camera and them, and that is
 * what washes a silhouette out where a beam crosses it.
 */
/**
 * Airlight, rendered into a half-size layer and scaled up. Blur cost scales
 * with area, and these are the widest blurs in the frame — at full resolution
 * the two wedges alone cost more than everything else put together, and a
 * 16px blur upscaled from half size is indistinguishable from one taken at
 * full size.
 */
export function drawBeam(
  ctx: Ctx, f: Frame, beam: Beam, flicker: number, into: Layer,
): void {
  const k = into.canvas.width / f.w;
  const g2 = into.ctx;
  g2.clearRect(0, 0, into.canvas.width, into.canvas.height);

  const wedge = (spread: number, alpha: number): void => {
    const a = beam.angle - spread;
    const b = beam.angle + spread;
    const ax = beam.ax * k;
    const ay = beam.ay * k;
    const len = beam.len * k;
    g2.beginPath();
    g2.moveTo(ax, ay);
    g2.lineTo(ax + Math.cos(a) * len, ay + Math.sin(a) * len);
    g2.lineTo(ax + Math.cos(b) * len, ay + Math.sin(b) * len);
    g2.closePath();
    const g = g2.createLinearGradient(
      ax, ay, ax + Math.cos(beam.angle) * len, ay + Math.sin(beam.angle) * len,
    );
    g.addColorStop(0, rgba(LIGHT, alpha));
    g.addColorStop(0.34, rgba(LIGHT, alpha * 0.6));
    g.addColorStop(1, rgba(LIGHT, 0));
    g2.fillStyle = g;
    g2.fill();
  };

  // A soft skirt with a hotter core inside it. One flat wedge reads as a
  // triangle of paint; two nested ones read as a beam.
  withBlur(g2, 16 * f.u * k, () => wedge(CONE_SPREAD, 0.115 * flicker));
  withBlur(g2, 8 * f.u * k, () => wedge(CONE_SPREAD * 0.42, 0.085 * flicker));

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.drawImage(into.canvas, 0, 0, f.w, f.h);
  ctx.restore();
}

/** Where the beam meets the track. */
export function drawPool(ctx: Ctx, f: Frame, flicker: number, atX?: number): void {
  const cx = atX ?? POOL.x * f.w;
  const cy = POOL.y * f.h;
  const rx = POOL.rx * f.w;
  const ry = POOL.ry * f.h;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, rgba(LIGHT, 0.4 * flicker));
  g.addColorStop(0.4, rgba(LIGHT, 0.19 * flicker));
  g.addColorStop(1, rgba(LIGHT, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/**
 * The corn's own shadow, raked across the lit track. Same trick as the
 * rabbit's: a copy of the field already painted in the ground's colour is
 * flattened and sheared away from the lamp, so it subtracts light rather than
 * adding dark. Bars of shadow crossing a lit floor are the single most
 * volumetric thing in the frame, and they cost one transformed blit.
 */
export function drawCornShadow(
  ctx: Ctx, f: Frame, cornInGroundTone: HTMLCanvasElement, alpha = 0.82,
): void {
  const baseY = CORN_WALL.base * f.h;
  const stretch = 1.45;
  const flatten = 0.78;
  ctx.save();
  ctx.globalAlpha = alpha;
  withBlur(ctx, 3 * f.u, () => {
    // Negative d: the field's height lies down the ground plane toward the
    // camera. Positive lays the bars back behind the corn, where nothing sees
    // them.
    ctx.transform(1, 0, stretch, -flatten, -baseY * stretch, baseY * (1 + flatten));
    ctx.drawImage(cornInGroundTone, 0, 0);
  });
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Drifting matter
// ---------------------------------------------------------------------------

export type Mote = { x: number; y: number; r: number; vx: number; vy: number; phase: number };

export function seedMotes(rng: Rng, count: number): Mote[] {
  return Array.from({ length: count }, () => ({
    x: rng.range(0.05, 1),
    y: rng.range(0.1, 0.95),
    r: rng.range(0.5, 2.1),
    vx: rng.range(0.004, 0.016),
    vy: rng.range(0.002, 0.011),
    phase: rng.range(0, Math.PI * 2),
  }));
}

/** Dust is only ever visible where the beam finds it — which is precisely what
 *  makes the beam look like it occupies air rather than sitting on the glass. */
export function drawMotes(
  ctx: Ctx, f: Frame, motes: Mote[], beam: Beam, dt: number, t: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const m of motes) {
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    if (m.y > 1.02) { m.y = 0.08; m.x = (m.x + 0.37) % 1; }
    if (m.x > 1.02) m.x -= 1.04;
    const px = (m.x + Math.sin(t * 0.7 + m.phase) * 0.006) * f.w;
    const py = m.y * f.h;
    const lit = beamIntensity(beam, px, py);
    if (lit <= 0.02) continue;
    ctx.fillStyle = rgba(LIGHT, Math.min(0.62, lit * 0.75));
    ctx.beginPath();
    ctx.arc(px, py, m.r * f.u, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export type FogBlob = { x: number; y: number; r: number; speed: number; alpha: number };

export function seedFog(rng: Rng, count: number): FogBlob[] {
  return Array.from({ length: count }, () => ({
    x: rng.range(-0.1, 1.1),
    y: rng.range(0.58, 0.78),
    r: rng.range(0.09, 0.26),
    speed: rng.range(0.004, 0.016),
    alpha: rng.range(0.014, 0.036),
  }));
}

/** Patchy ground mist. Blobs rather than bands, because a band drifting
 *  sideways is indistinguishable from a band standing still. */
export function drawFog(ctx: Ctx, f: Frame, blobs: FogBlob[], dt: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const b of blobs) {
    b.x += b.speed * dt;
    if (b.x - b.r > 1.15) b.x = -0.15 - b.r;
    const cx = b.x * f.w;
    const cy = b.y * f.h;
    const r = b.r * f.w;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, rgba(FOG, b.alpha));
    g.addColorStop(1, rgba(FOG, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Three specks turning over the far field. Almost invisible, and the frame
 *  feels abandoned without them. */
export function drawBirds(ctx: Ctx, f: Frame, t: number): void {
  ctx.save();
  ctx.fillStyle = rgba(depthColor(0.66), 0.85);
  for (let i = 0; i < 3; i += 1) {
    const p = t * 0.02 + i * 0.31;
    const x = (0.12 + ((p * 0.6) % 1) * 0.5) * f.w;
    const y = (0.3 + Math.sin(p * 2.1 + i) * 0.045) * f.h;
    const flap = Math.sin(t * 3.4 + i * 2) * 0.8;
    ctx.beginPath();
    ctx.moveTo(x - 3.2 * f.u, y + flap * f.u);
    ctx.quadraticCurveTo(x, y - 1.6 * f.u, x + 3.2 * f.u, y + flap * f.u);
    ctx.quadraticCurveTo(x, y + 0.5 * f.u, x - 3.2 * f.u, y + flap * f.u);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Post
// ---------------------------------------------------------------------------

const TILE = 128;

/** Four noise tiles, cycled. Regenerating every frame costs more than it buys;
 *  four is already past the point where the eye can find the repeat. */
export function makeGrain(rng: Rng): Layer[] {
  return Array.from({ length: 4 }, () => {
    const layer = createLayer(TILE, TILE);
    const image = layer.ctx.createImageData(TILE, TILE);
    for (let i = 0; i < image.data.length; i += 4) {
      const v = 118 + rng.range(-46, 46);
      image.data[i] = v;
      image.data[i + 1] = v;
      image.data[i + 2] = v;
      image.data[i + 3] = 255;
    }
    layer.ctx.putImageData(image, 0, 0);
    return layer;
  });
}

/** Grain is what stops the layers reading as clean vector shapes. It is the
 *  cheapest single thing in the file and the one most responsible for the
 *  image looking photographed. */
export function drawGrain(ctx: Ctx, f: Frame, tiles: Layer[], frameIndex: number): void {
  const tile = tiles[frameIndex % tiles.length];
  const pattern = ctx.createPattern(tile.canvas, "repeat");
  if (!pattern) return;
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.085;
  const dx = (frameIndex * 37) % TILE;
  const dy = (frameIndex * 53) % TILE;
  ctx.translate(-dx, -dy);
  ctx.fillStyle = pattern;
  ctx.fillRect(dx, dy, f.w, f.h);
  ctx.restore();
}

/** Off-centre, pulled toward the lamp, so the corners fall away and the eye is
 *  walked to the light and then back down to the rabbit. */
export function drawVignette(ctx: Ctx, f: Frame): void {
  const cx = 0.6 * f.w;
  const cy = 0.44 * f.h;
  const outer = Math.hypot(f.w, f.h) * 0.78;
  const g = ctx.createRadialGradient(cx, cy, outer * 0.26, cx, cy, outer);
  g.addColorStop(0, "rgba(3, 5, 6, 0)");
  g.addColorStop(0.62, "rgba(3, 5, 6, 0.34)");
  g.addColorStop(1, "rgba(3, 5, 6, 0.72)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, f.w, f.h);
}
